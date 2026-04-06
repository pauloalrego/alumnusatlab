"""
Unit tests for app/routers/admin.py

Uses the TestClient with an in-memory SQLite DB.
Auth dependencies are overridden with helpers that inject a preset user.

Covers:
- GET  /admin/stats
- GET  /admin/users
- PUT  /admin/users/{user_id}
- DELETE /admin/users/{user_id}
- POST /admin/bulk-delete
- DELETE /admin/researchers/{researcher_id}
"""

from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.deps import require_dashboard, require_superadmin
from app.database import get_db
from app.models import (
    User,
    Researcher,
    Institution,
    Professor,
    ProfessorInstitution,
    ResearchGroup,
)

from app.models import ProfessorGroup

from .conftest import make_user, make_researcher, make_reminder


# ---------------------------------------------------------------------------
# Helper: override a dependency with a fixed user
# ---------------------------------------------------------------------------

def _override_deps(db_session, acting_user: User):
    """Return a dict of overrides that inject db_session and acting_user."""

    def _get_db():
        yield db_session

    def _require_dashboard():
        return acting_user

    def _require_superadmin():
        return acting_user

    return {
        get_db: _get_db,
        require_dashboard: _require_dashboard,
        require_superadmin: _require_superadmin,
    }


@pytest.fixture
def superadmin_client(db):
    sa = make_user(db, email="sa@univ.edu.br", nome="Super Admin", role="superadmin")
    app.dependency_overrides.update(_override_deps(db, sa))
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c, sa, db
    app.dependency_overrides.clear()


@pytest.fixture
def professor_client(db):
    prof = make_user(db, email="prof@univ.edu.br", nome="Professor", role="professor")
    app.dependency_overrides.update(_override_deps(db, prof))
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c, prof, db
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# GET /admin/stats
# ---------------------------------------------------------------------------

class TestGetStats:
    def test_superadmin_sees_all_role_counts(self, superadmin_client):
        client, sa, db = superadmin_client
        # Add another user of a different role
        make_user(db, email="s@univ.edu.br", role="researcher")

        resp = client.get("/api/admin/stats")
        assert resp.status_code == 200
        body = resp.json()
        assert "users_by_role" in body
        assert "total_researchers" in body
        assert "total_reminders" in body

    def test_professor_sees_stats_without_superadmin_count(self, professor_client):
        client, prof, db = professor_client
        resp = client.get("/api/admin/stats")
        assert resp.status_code == 200
        body = resp.json()
        # superadmin count hidden
        assert body["users_by_role"]["superadmin"] == 0

    def test_stats_counts_reminders(self, superadmin_client):
        client, sa, db = superadmin_client
        make_reminder(db, text="R1")
        make_reminder(db, text="R2")

        resp = client.get("/api/admin/stats")
        assert resp.json()["total_reminders"] == 2

    def test_stats_counts_researchers(self, superadmin_client):
        client, sa, db = superadmin_client
        make_researcher(db, nome="Dr. X", email="drx@univ.edu.br", ativo=True)

        resp = client.get("/api/admin/stats")
        assert resp.json()["total_researchers"] >= 1


# ---------------------------------------------------------------------------
# GET /admin/users
# ---------------------------------------------------------------------------

class TestListUsers:
    def test_returns_list_with_registered_users(self, superadmin_client):
        client, sa, db = superadmin_client
        make_user(db, email="u1@univ.edu.br")

        resp = client.get("/api/admin/users")
        assert resp.status_code == 200
        emails = [u["email"] for u in resp.json()]
        assert "sa@univ.edu.br" in emails
        assert "u1@univ.edu.br" in emails

    def test_pending_researchers_included(self, superadmin_client):
        client, sa, db = superadmin_client
        make_researcher(db, nome="Pendente X", email="pending@univ.edu.br", password=None, ativo=True)

        resp = client.get("/api/admin/users")
        assert resp.status_code == 200
        names = [u["nome"] for u in resp.json()]
        assert "Pendente X" in names

    def test_professor_excludes_pure_superadmin(self, professor_client):
        client, prof, db = professor_client
        # superadmin without researcher_id should be excluded for professor view
        sa = make_user(db, email="puresu@univ.edu.br", role="superadmin")

        resp = client.get("/api/admin/users")
        assert resp.status_code == 200
        emails = [u["email"] for u in resp.json()]
        assert "puresu@univ.edu.br" not in emails

    def test_superadmin_with_researcher_linked_but_not_visible_without_institution(self, professor_client):
        """Superadmin com researcher_id não aparece para professor sem vínculo de instituição."""
        client, prof, db = professor_client
        # Cria Researcher sem User (estado de arquivo — ativo=False)
        from app.models import Researcher as ResearcherModel
        bare_researcher = ResearcherModel(status="mestrado", ativo=True)
        db.add(bare_researcher)
        db.flush()
        make_user(db, email="saresearch@univ.edu.br", role="superadmin", researcher_id=bare_researcher.id)

        resp = client.get("/api/admin/users")
        assert resp.status_code == 200
        # Professor sem instituição vê apenas si mesmo
        emails = [u["email"] for u in resp.json()]
        assert "saresearch@univ.edu.br" not in emails

    def test_professor_sees_only_users_from_linked_institutions(self, professor_client):
        client, acting_user, db = professor_client

        prof = Professor()
        db.add(prof)
        db.flush()
        acting_user.professor_id = prof.id

        inst_a = Institution(name="Inst A", domain="insta.edu.br")
        inst_b = Institution(name="Inst B", domain="instb.edu.br")
        db.add_all([inst_a, inst_b])
        db.flush()

        db.add(
            ProfessorInstitution(
                professor_id=prof.id,
                institution_id=inst_a.id,
                institutional_email="prof@insta.edu.br",
            )
        )

        # Aluno da instituição vinculada (deve aparecer)
        group_a = ResearchGroup(name="GA", institution_id=inst_a.id)
        db.add(group_a)
        db.flush()
        res_a = Researcher(status="mestrado", group_id=group_a.id, ativo=True)
        db.add(res_a)
        db.flush()
        make_user(db, email="alunoa@insta.edu.br", nome="Aluno A", role="researcher", researcher_id=res_a.id)

        # Aluno de outra instituição (não deve aparecer)
        group_b = ResearchGroup(name="GB", institution_id=inst_b.id)
        db.add(group_b)
        db.flush()
        res_b = Researcher(status="mestrado", group_id=group_b.id, ativo=True)
        db.add(res_b)
        db.flush()
        make_user(db, email="alunob@instb.edu.br", nome="Aluno B", role="researcher", researcher_id=res_b.id)

        db.commit()

        resp = client.get("/api/admin/users")
        assert resp.status_code == 200
        emails = [u["email"] for u in resp.json()]
        assert "alunoa@insta.edu.br" in emails
        assert "alunob@instb.edu.br" not in emails

    def test_professor_with_multiple_institutions_sees_both(self, professor_client):
        client, acting_user, db = professor_client

        prof = Professor()
        db.add(prof)
        db.flush()
        acting_user.professor_id = prof.id

        inst_a = Institution(name="Inst M1", domain="m1.edu.br")
        inst_b = Institution(name="Inst M2", domain="m2.edu.br")
        db.add_all([inst_a, inst_b])
        db.flush()

        db.add_all(
            [
                ProfessorInstitution(
                    professor_id=prof.id,
                    institution_id=inst_a.id,
                    institutional_email="prof.m1@m1.edu.br",
                ),
                ProfessorInstitution(
                    professor_id=prof.id,
                    institution_id=inst_b.id,
                    institutional_email="prof.m2@m2.edu.br",
                ),
            ]
        )

        group_a = ResearchGroup(name="GM1", institution_id=inst_a.id)
        group_b = ResearchGroup(name="GM2", institution_id=inst_b.id)
        db.add_all([group_a, group_b])
        db.flush()

        res_a = Researcher(status="mestrado", group_id=group_a.id, ativo=True)
        res_b = Researcher(status="mestrado", group_id=group_b.id, ativo=True)
        db.add_all([res_a, res_b])
        db.flush()

        make_user(db, email="aluno.m1@m1.edu.br", nome="Aluno M1", role="researcher", researcher_id=res_a.id)
        make_user(db, email="aluno.m2@m2.edu.br", nome="Aluno M2", role="researcher", researcher_id=res_b.id)

        db.commit()

        resp = client.get("/api/admin/users")
        assert resp.status_code == 200
        emails = [u["email"] for u in resp.json()]
        assert "aluno.m1@m1.edu.br" in emails
        assert "aluno.m2@m2.edu.br" in emails

    def test_response_sorted_superadmin_first(self, superadmin_client):
        client, sa, db = superadmin_client
        make_user(db, email="z_student@univ.edu.br", role="researcher")

        resp = client.get("/api/admin/users")
        users = resp.json()
        # filter out pending rows (id=None)
        real_users = [u for u in users if u.get("id") is not None]
        roles = [u["role"] for u in real_users]
        # superadmin should appear before researcher
        if "superadmin" in roles and "researcher" in roles:
            assert roles.index("superadmin") < roles.index("researcher")


# ---------------------------------------------------------------------------
# PUT /admin/users/{user_id}
# ---------------------------------------------------------------------------

class TestUpdateUser:
    def test_superadmin_can_update_another_users_role(self, superadmin_client):
        client, sa, db = superadmin_client
        student = make_user(db, email="target@univ.edu.br", role="researcher")

        resp = client.put(f"/api/admin/users/{student.id}", json={"role": "professor"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "professor"

    def test_cannot_update_own_role(self, superadmin_client):
        client, sa, db = superadmin_client
        resp = client.put(f"/api/admin/users/{sa.id}", json={"role": "researcher"})
        assert resp.status_code == 400

    def test_invalid_role_returns_400(self, superadmin_client):
        client, sa, db = superadmin_client
        other = make_user(db, email="other@univ.edu.br", role="researcher")
        resp = client.put(f"/api/admin/users/{other.id}", json={"role": "invalid_role"})
        assert resp.status_code == 400

    def test_nonexistent_user_returns_404(self, superadmin_client):
        client, sa, db = superadmin_client
        resp = client.put("/api/admin/users/99999", json={"role": "researcher"})
        assert resp.status_code == 404

    def test_promotion_to_professor_sets_plan_defaults(self, superadmin_client):
        client, sa, db = superadmin_client
        student = make_user(db, email="promote@univ.edu.br", role="researcher")

        resp = client.put(f"/api/admin/users/{student.id}", json={"role": "professor"})
        assert resp.status_code == 200
        db.refresh(student)
        assert student.plan is not None
        assert student.plan.plan_type == "trial"

    def test_demotion_to_researcher_clears_plan(self, superadmin_client):
        client, sa, db = superadmin_client
        prof = make_user(
            db,
            email="demote@univ.edu.br",
            role="professor",
            plan_type="trial",
            plan_status="active",
        )

        resp = client.put(f"/api/admin/users/{prof.id}", json={"role": "researcher"})
        assert resp.status_code == 200
        db.refresh(prof)
        assert prof.plan is None or prof.plan.plan_type is None

    def test_is_admin_set_for_superadmin_role(self, superadmin_client):
        client, sa, db = superadmin_client
        researcher = make_user(db, email="toadmin@univ.edu.br", role="researcher")

        resp = client.put(f"/api/admin/users/{researcher.id}", json={"role": "superadmin"})
        assert resp.status_code == 200
        db.refresh(researcher)
        assert researcher.role == "superadmin"


# ---------------------------------------------------------------------------
# DELETE /admin/users/{user_id}
# ---------------------------------------------------------------------------

class TestDeleteUser:
    def test_superadmin_can_delete_student(self, superadmin_client):
        client, sa, db = superadmin_client
        student = make_user(db, email="del@univ.edu.br", role="researcher")

        resp = client.delete(f"/api/admin/users/{student.id}")
        assert resp.status_code == 204

        assert db.query(User).filter(User.id == student.id).first() is None

    def test_cannot_delete_own_account(self, superadmin_client):
        client, sa, db = superadmin_client
        resp = client.delete(f"/api/admin/users/{sa.id}")
        assert resp.status_code == 400

    def test_nonexistent_user_returns_404(self, superadmin_client):
        client, sa, db = superadmin_client
        resp = client.delete("/api/admin/users/99999")
        assert resp.status_code == 404

    def test_professor_cannot_delete_superadmin(self, professor_client):
        client, prof, db = professor_client
        # professor_client uses require_dashboard — the check is inside the handler
        sa_user = make_user(db, email="protected@univ.edu.br", role="superadmin")

        resp = client.delete(f"/api/admin/users/{sa_user.id}")
        assert resp.status_code == 403

    def test_deleting_user_marks_researcher_inactive(self, superadmin_client):
        client, sa, db = superadmin_client
        researcher = make_researcher(db, nome="R del", email="rdel@univ.edu.br", password="somepassword1")
        # make_researcher cria User vinculado — obter pelo researcher_id
        from app.models import User as UserModel
        student = db.query(UserModel).filter(UserModel.researcher_id == researcher.id).first()

        client.delete(f"/api/admin/users/{student.id}")
        db.refresh(researcher)
        assert researcher.ativo is False
        assert researcher.registered is False


# ---------------------------------------------------------------------------
# POST /admin/bulk-delete
# ---------------------------------------------------------------------------

class TestBulkDelete:
    def test_bulk_delete_users(self, superadmin_client):
        client, sa, db = superadmin_client
        u1 = make_user(db, email="bd1@univ.edu.br", role="researcher")
        u2 = make_user(db, email="bd2@univ.edu.br", role="researcher")

        resp = client.post("/api/admin/bulk-delete", json={"user_ids": [u1.id, u2.id], "researcher_ids": []})
        assert resp.status_code == 204
        assert db.query(User).filter(User.id == u1.id).first() is None
        assert db.query(User).filter(User.id == u2.id).first() is None

    def test_bulk_delete_skips_own_id(self, superadmin_client):
        client, sa, db = superadmin_client

        resp = client.post("/api/admin/bulk-delete", json={"user_ids": [sa.id], "researcher_ids": []})
        assert resp.status_code == 204
        # self should not be deleted
        assert db.query(User).filter(User.id == sa.id).first() is not None

    def test_bulk_delete_unregistered_researchers(self, superadmin_client):
        client, sa, db = superadmin_client
        r = make_researcher(db, nome="Pending R", email="pr@univ.edu.br", password=None)

        resp = client.post("/api/admin/bulk-delete", json={"user_ids": [], "researcher_ids": [r.id]})
        assert resp.status_code == 204
        assert db.query(Researcher).filter(Researcher.id == r.id).first() is None

    def test_bulk_delete_skips_registered_researchers(self, superadmin_client):
        client, sa, db = superadmin_client
        r = make_researcher(db, nome="Reg R", email="regr@univ.edu.br", password="somepassword1")

        resp = client.post("/api/admin/bulk-delete", json={"user_ids": [], "researcher_ids": [r.id]})
        assert resp.status_code == 204
        # registered researcher should NOT be deleted via this route
        assert db.query(Researcher).filter(Researcher.id == r.id).first() is not None

    def test_bulk_delete_does_not_delete_superadmin_when_caller_is_professor(self, professor_client):
        client, prof, db = professor_client
        sa_user = make_user(db, email="sabd@univ.edu.br", role="superadmin")

        resp = client.post("/api/admin/bulk-delete", json={"user_ids": [sa_user.id], "researcher_ids": []})
        assert resp.status_code == 204
        assert db.query(User).filter(User.id == sa_user.id).first() is not None


# ---------------------------------------------------------------------------
# DELETE /admin/researchers/{researcher_id}
# ---------------------------------------------------------------------------

class TestDeletePendingResearcher:
    def test_deletes_unregistered_researcher(self, superadmin_client):
        client, sa, db = superadmin_client
        r = make_researcher(db, nome="Pendente", email="pend@univ.edu.br", password=None)

        resp = client.delete(f"/api/admin/researchers/{r.id}")
        assert resp.status_code == 204
        assert db.query(Researcher).filter(Researcher.id == r.id).first() is None

    def test_404_for_nonexistent_researcher(self, superadmin_client):
        client, sa, db = superadmin_client
        resp = client.delete("/api/admin/researchers/99999")
        assert resp.status_code == 404

    def test_400_when_researcher_already_registered(self, superadmin_client):
        client, sa, db = superadmin_client
        r = make_researcher(db, nome="Cadastrado", email="cad@univ.edu.br", password="somepassword1")

        resp = client.delete(f"/api/admin/researchers/{r.id}")
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# _accessible_institution_ids — cobertura dos caminhos de otimização
# ---------------------------------------------------------------------------

class TestAccessibleInstitutionIds:
    """Garante que _accessible_institution_ids usa UNION e não lazy-load."""

    def _make_prof_with_institution(self, db, email, domain):
        """Cria professor + user + instituição vinculada via ProfessorInstitution."""
        prof = Professor()
        db.add(prof)
        db.flush()
        inst = Institution(name=domain.upper(), domain=domain)
        db.add(inst)
        db.flush()
        db.add(ProfessorInstitution(
            professor_id=prof.id,
            institution_id=inst.id,
            institutional_email=email,
        ))
        user = make_user(db, email=email, role="professor")
        user.professor_id = prof.id
        db.commit()
        db.refresh(user)
        return user, prof, inst

    def test_professor_without_professor_id_sees_no_users(self, db):
        """User com professor_id=None → institution_ids=set() → lista vazia."""
        acting = make_user(db, email="noprof@univ.edu.br", role="professor")
        # professor_id permanece None

        from app.routers.admin import _accessible_institution_ids
        result = _accessible_institution_ids(db, acting)
        assert result == set()

    def test_professor_linked_via_professor_institutions(self, db):
        """Instituição vinculada por ProfessorInstitution aparece no resultado."""
        acting, prof, inst = self._make_prof_with_institution(db, "pi@pi.edu.br", "pi.edu.br")

        from app.routers.admin import _accessible_institution_ids
        result = _accessible_institution_ids(db, acting)
        assert inst.id in result

    def test_professor_linked_only_via_professor_groups(self, db):
        """Instituição vinculada APENAS por ProfessorGroup (sem ProfessorInstitution)
        ainda aparece — valida o UNION."""
        prof = Professor()
        db.add(prof)
        db.flush()
        inst = Institution(name="GroupOnly", domain="grponly.edu.br")
        db.add(inst)
        db.flush()
        group = ResearchGroup(name="G", institution_id=inst.id)
        db.add(group)
        db.flush()
        db.add(ProfessorGroup(
            professor_id=prof.id,
            group_id=group.id,
            role_in_group="coordinator",
            institution_id=inst.id,
        ))
        acting = make_user(db, email="grponly@grponly.edu.br", role="professor")
        acting.professor_id = prof.id
        db.commit()
        db.refresh(acting)

        from app.routers.admin import _accessible_institution_ids
        result = _accessible_institution_ids(db, acting)
        assert inst.id in result

    def test_superadmin_returns_none(self, db):
        sa = make_user(db, email="sa2@univ.edu.br", role="superadmin")
        from app.routers.admin import _accessible_institution_ids
        assert _accessible_institution_ids(db, sa) is None


class TestCountGroups:
    """_count_groups usa current.professor_id diretamente (sem buscar professor)."""

    def test_superadmin_counts_all_groups(self, db):
        from app.routers.admin import _count_groups
        sa = make_user(db, email="sag@univ.edu.br", role="superadmin")
        inst = Institution(name="G Inst", domain="ginst.edu.br")
        db.add(inst)
        db.flush()
        db.add(ResearchGroup(name="G1", institution_id=inst.id))
        db.add(ResearchGroup(name="G2", institution_id=inst.id))
        db.commit()
        assert _count_groups(db, sa) == 2

    def test_professor_counts_own_groups(self, db):
        from app.routers.admin import _count_groups
        prof = Professor()
        db.add(prof)
        db.flush()
        inst = Institution(name="CG Inst", domain="cginst.edu.br")
        db.add(inst)
        db.flush()
        g1 = ResearchGroup(name="CG1", institution_id=inst.id)
        g2 = ResearchGroup(name="CG2", institution_id=inst.id)
        g3 = ResearchGroup(name="CG3", institution_id=inst.id)
        db.add_all([g1, g2, g3])
        db.flush()
        db.add(ProfessorGroup(professor_id=prof.id, group_id=g1.id, role_in_group="coordinator"))
        db.add(ProfessorGroup(professor_id=prof.id, group_id=g2.id, role_in_group="member"))
        # g3 não pertence ao professor
        acting = make_user(db, email="cg@cginst.edu.br", role="professor")
        acting.professor_id = prof.id
        db.commit()
        db.refresh(acting)

        assert _count_groups(db, acting) == 2

    def test_professor_without_professor_id_returns_zero(self, db):
        from app.routers.admin import _count_groups
        acting = make_user(db, email="noprofcg@univ.edu.br", role="professor")
        assert _count_groups(db, acting) == 0


# ---------------------------------------------------------------------------
# POST /admin/invite-professor
# ---------------------------------------------------------------------------

class TestInviteProfessor:
    def test_creates_user_and_professor(self, superadmin_client):
        client, sa, db = superadmin_client
        resp = client.post("/api/admin/invite-professor", json={
            "nome": "Novo Prof",
            "email": "novoprof@univ.edu.br",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["role"] == "professor"
        assert data["email"] == "novoprof@univ.edu.br"

        # Verifica User criado
        user = db.query(User).filter(User.id == data["id"]).first()
        assert user is not None
        assert user.role == "professor"
        assert user.password_hash is None  # conta pendente

        # Verifica Professor vinculado
        assert user.professor_id is not None
        prof = db.query(Professor).filter(Professor.id == user.professor_id).first()
        assert prof is not None

    def test_creates_trial_plan(self, superadmin_client):
        client, sa, db = superadmin_client
        resp = client.post("/api/admin/invite-professor", json={
            "nome": "Prof Trial",
            "email": "proftrial@univ.edu.br",
        })
        assert resp.status_code == 201
        from app.models import UserPlan
        user_id = resp.json()["id"]
        plan = db.query(UserPlan).filter(UserPlan.user_id == user_id).first()
        assert plan is not None
        assert plan.plan_type == "trial"
        assert plan.plan_status == "active"
        assert plan.account_activated_at is not None
        assert plan.plan_period_ends_at is not None

    def test_links_institution(self, superadmin_client):
        client, sa, db = superadmin_client
        inst = Institution(name="Inst Prof", domain="instprof.edu.br")
        db.add(inst)
        db.commit()

        resp = client.post("/api/admin/invite-professor", json={
            "nome": "Prof Inst",
            "email": "profinst@instprof.edu.br",
            "institution_id": inst.id,
        })
        assert resp.status_code == 201
        user = db.query(User).filter(User.id == resp.json()["id"]).first()
        pi = db.query(ProfessorInstitution).filter(
            ProfessorInstitution.professor_id == user.professor_id
        ).first()
        assert pi is not None
        assert pi.institution_id == inst.id

    def test_duplicate_email_returns_409(self, superadmin_client):
        client, sa, db = superadmin_client
        make_user(db, email="dup@univ.edu.br", role="researcher")
        resp = client.post("/api/admin/invite-professor", json={
            "nome": "Dup Prof",
            "email": "dup@univ.edu.br",
        })
        assert resp.status_code == 409

    def test_professor_can_invite(self, professor_client):
        client, prof, db = professor_client
        resp = client.post("/api/admin/invite-professor", json={
            "nome": "Convidado",
            "email": "convidado@univ.edu.br",
        })
        assert resp.status_code == 201

    def test_creates_entrada_milestone(self, superadmin_client):
        client, sa, db = superadmin_client
        resp = client.post("/api/admin/invite-professor", json={
            "nome": "Prof Marco",
            "email": "profmarco@univ.edu.br",
        })
        assert resp.status_code == 201
        from app.models import Milestone
        user_id = resp.json()["id"]
        m = db.query(Milestone).filter(
            Milestone.user_id == user_id,
            Milestone.type == "entrada",
        ).first()
        assert m is not None
        assert m.title == "Entrada no Alumnus"
        assert m.created_by_id == user_id

    def test_rejects_public_email(self, superadmin_client):
        client, sa, db = superadmin_client
        for email in ["prof@gmail.com", "prof@hotmail.com", "prof@outlook.com", "prof@yahoo.com.br", "prof@uol.com.br"]:
            resp = client.post("/api/admin/invite-professor", json={
                "nome": "Prof Publico",
                "email": email,
            })
            assert resp.status_code == 400, f"Expected 400 for {email}, got {resp.status_code}"
            assert "institucional" in resp.json()["detail"].lower()

    def test_accepts_institutional_email(self, superadmin_client):
        client, sa, db = superadmin_client
        resp = client.post("/api/admin/invite-professor", json={
            "nome": "Prof Institucional",
            "email": "prof@ufpa.br",
        })
        assert resp.status_code == 201

    def test_inherits_institution_from_inviting_professor(self, professor_client):
        client, acting_user, db = professor_client

        # Cria professor + instituição para o professor que convida
        prof = Professor()
        db.add(prof)
        db.flush()
        acting_user.professor_id = prof.id

        inst = Institution(name="Origem Inst", domain="origem.edu.br")
        db.add(inst)
        db.flush()
        db.add(ProfessorInstitution(
            professor_id=prof.id,
            institution_id=inst.id,
            institutional_email="prof@origem.edu.br",
        ))
        db.commit()
        db.refresh(acting_user)

        # Convida sem informar institution_id
        resp = client.post("/api/admin/invite-professor", json={
            "nome": "Novo Prof Herdado",
            "email": "herdado@origem.edu.br",
        })
        assert resp.status_code == 201

        # Verifica que o novo professor herdou a instituição
        new_user = db.query(User).filter(User.id == resp.json()["id"]).first()
        new_pi = db.query(ProfessorInstitution).filter(
            ProfessorInstitution.professor_id == new_user.professor_id
        ).first()
        assert new_pi is not None
        assert new_pi.institution_id == inst.id


class TestListUsersViaGroupInstitution:
    """Professor vinculado por professor_groups vê usuários da mesma instituição."""

    def test_users_visible_when_linked_via_professor_group(self, db):
        prof = Professor()
        db.add(prof)
        db.flush()
        inst = Institution(name="GLink", domain="glink.edu.br")
        db.add(inst)
        db.flush()
        group = ResearchGroup(name="GL", institution_id=inst.id)
        db.add(group)
        db.flush()

        # Professor vinculado APENAS via ProfessorGroup (sem ProfessorInstitution)
        db.add(ProfessorGroup(
            professor_id=prof.id,
            group_id=group.id,
            role_in_group="coordinator",
            institution_id=inst.id,
        ))

        acting = make_user(db, email="glprof@glink.edu.br", role="professor")
        acting.professor_id = prof.id
        db.flush()

        # Researcher no mesmo grupo
        res = Researcher(status="mestrado", group_id=group.id)
        db.add(res)
        db.flush()
        make_user(db, email="glres@glink.edu.br", nome="GL Res", role="researcher", researcher_id=res.id)
        db.commit()
        db.refresh(acting)

        app.dependency_overrides.update({
            get_db: lambda: (yield db),
            require_dashboard: lambda: acting,
            require_superadmin: lambda: acting,
        })
        with TestClient(app, raise_server_exceptions=True) as c:
            resp = c.get("/api/admin/users")
        app.dependency_overrides.clear()

        assert resp.status_code == 200
        emails = [u["email"] for u in resp.json()]
        assert "glres@glink.edu.br" in emails
