"""Tests for app/services/researcher_service.py"""
import pytest
from passlib.context import CryptContext

from app.models import Institution, Professor, ProfessorGroup, ResearchGroup, User
from app.schemas import ResearcherCreate, ResearcherUpdate
from app.services import researcher_service

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def make_professor_with_group(db, nome="Prof Test", domain="test.br"):
    inst = Institution(name=nome.upper()[:10], domain=domain)
    db.add(inst)
    db.flush()
    prof = Professor()
    db.add(prof)
    db.flush()
    group = ResearchGroup(name=f"Grupo {nome}", institution_id=inst.id)
    db.add(group)
    db.flush()
    pg = ProfessorGroup(
        professor_id=prof.id,
        group_id=group.id,
        role_in_group="coordinator",
        institution_id=inst.id,
    )
    db.add(pg)
    user = User(
        email=f"prof@{domain}",
        nome=nome,
        password_hash=pwd_ctx.hash("pass"),
        role="professor",
        professor_id=prof.id,
    )
    db.add(user)
    db.commit()
    db.refresh(prof)
    return prof, group, inst


class TestCreate:
    def test_creates_researcher_and_user(self, db):
        data = ResearcherCreate(email="new@univ.br", nome="Novo Pesq", status="mestrado")
        r = researcher_service.create(db, data)
        assert r is not None
        assert r.user is not None
        assert r.user.email == "new@univ.br"
        assert r.status == "mestrado"

    def test_raises_409_on_duplicate_email(self, db):
        from fastapi import HTTPException
        researcher_service.create(db, ResearcherCreate(email="dup@univ.br", nome="Dup", status="mestrado"))
        with pytest.raises(HTTPException) as exc:
            researcher_service.create(db, ResearcherCreate(email="dup@univ.br", nome="Dup2", status="doutorado"))
        assert exc.value.status_code == 409

    def test_resolves_group_from_orientador(self, db):
        prof, group, _ = make_professor_with_group(db, "Prof Orientador", "orientador.br")
        data = ResearcherCreate(
            email="orient@orientador.br",
            nome="Orientado",
            status="doutorado",
            orientador_id=prof.id,
        )
        r = researcher_service.create(db, data)
        assert r.group_id == group.id

    def test_resolves_group_from_institution(self, db):
        _, group, inst = make_professor_with_group(db, "Prof Inst Group", "instgroup.br")
        data = ResearcherCreate(
            email="instgroup@instgroup.br",
            nome="InstGroup Pesq",
            status="mestrado",
            institution_id=inst.id,
        )
        r = researcher_service.create(db, data)
        assert r.group_id == group.id

    def test_user_has_no_password(self, db):
        data = ResearcherCreate(email="nopw@univ.br", nome="No PW", status="graduacao")
        r = researcher_service.create(db, data)
        assert r.user.password_hash is None

    def test_registered_is_false_without_password(self, db):
        data = ResearcherCreate(email="unreg@univ.br", nome="Unreg", status="mestrado")
        r = researcher_service.create(db, data)
        assert r.registered is False


class TestListAll:
    def test_list_all_no_filter(self, db):
        researcher_service.create(db, ResearcherCreate(email="list1@univ.br", nome="List 1", status="graduacao"))
        results = researcher_service.list_all(db, ativo=None)
        assert len(results) >= 1

    def test_filter_active(self, db):
        r = researcher_service.create(db, ResearcherCreate(email="active@univ.br", nome="Active", status="mestrado"))
        results = researcher_service.list_all(db, ativo=True)
        ids = [x.id for x in results]
        assert r.id in ids

    def test_filter_inactive(self, db):
        r = researcher_service.create(db, ResearcherCreate(email="inactive@univ.br", nome="Inactive", status="mestrado"))
        researcher_service.deactivate(db, r)
        results = researcher_service.list_all(db, ativo=False)
        ids = [x.id for x in results]
        assert r.id in ids

    def test_filter_by_institution(self, db):
        _, group, inst = make_professor_with_group(db, "Prof List Inst", "listinst.br")
        data = ResearcherCreate(email="listinst@listinst.br", nome="List Inst", status="mestrado", institution_id=inst.id)
        r = researcher_service.create(db, data)
        results = researcher_service.list_all(db, ativo=None, institution_id=inst.id)
        ids = [x.id for x in results]
        assert r.id in ids


class TestGetById:
    def test_returns_researcher(self, db):
        r = researcher_service.create(db, ResearcherCreate(email="getby@univ.br", nome="GetBy", status="postdoc"))
        found = researcher_service.get_by_id(db, r.id)
        assert found is not None
        assert found.id == r.id

    def test_returns_none_for_unknown(self, db):
        assert researcher_service.get_by_id(db, 9999) is None


class TestFindBySlug:
    def test_finds_by_slug(self, db):
        r = researcher_service.create(db, ResearcherCreate(email="slug@univ.br", nome="Fulano Da Silva", status="mestrado"))
        found = researcher_service.find_by_slug(db, "fulano-da-silva")
        assert found is not None
        assert found.id == r.id

    def test_returns_none_for_unknown_slug(self, db):
        assert researcher_service.find_by_slug(db, "nao-existe-xyz") is None

    def test_inactive_not_found_by_slug(self, db):
        r = researcher_service.create(db, ResearcherCreate(email="inactslug@univ.br", nome="Inactive Slug", status="mestrado"))
        researcher_service.deactivate(db, r)
        found = researcher_service.find_by_slug(db, "inactive-slug")
        assert found is None


class TestGetLinkedUser:
    def test_returns_linked_user(self, db):
        r = researcher_service.create(db, ResearcherCreate(email="linked@univ.br", nome="Linked", status="mestrado"))
        user = researcher_service.get_linked_user(db, r.id)
        assert user is not None
        assert user.email == "linked@univ.br"

    def test_returns_none_for_unknown(self, db):
        user = researcher_service.get_linked_user(db, 9999)
        assert user is None


class TestUpdate:
    def test_updates_status(self, db):
        r = researcher_service.create(db, ResearcherCreate(email="upd@univ.br", nome="Upd", status="mestrado"))
        updated = researcher_service.update(db, r, ResearcherUpdate(status="doutorado"))
        assert updated.status == "doutorado"



class TestDeactivate:
    def test_deactivates_researcher(self, db):
        r = researcher_service.create(db, ResearcherCreate(email="deact@univ.br", nome="Deact", status="mestrado"))
        researcher_service.deactivate(db, r)
        assert r.ativo is False
