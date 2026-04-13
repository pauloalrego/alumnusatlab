import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import require_dashboard, require_superadmin, require_professor
from ..models import User, UserPlan, Researcher, Reminder, Tip, TipComment, Note, ResearchGroup, ProfessorGroup, Professor, ProfessorInstitution, Milestone
from ..plan import clear_plan, ensure_professor_plan_defaults
from ..institutional_email import is_public_email_domain

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

VALID_ROLES = ("professor", "researcher", "superadmin")

_ADMIN_USER_LIST_ROLE_ORDER = {
    "superadmin": 0,
    "professor":  1,
    "researcher": 2,
}


class UserRoleUpdate(BaseModel):
    role: str


class BulkDeleteRequest(BaseModel):
    user_ids: list[int] = []
    researcher_ids: list[int] = []


def _is_superadmin(user: User) -> bool:
    return user.role == "superadmin"


def _count_groups(db: Session, current: User | None) -> int:
    """Superadmin vê todos os grupos; professor vê apenas seus grupos."""
    if current is None or _is_superadmin(current):
        return db.query(func.count(ResearchGroup.id)).scalar()
    if not current.professor_id:
        return 0
    return db.query(func.count(ProfessorGroup.group_id)).filter(
        ProfessorGroup.professor_id == current.professor_id
    ).scalar()


def _accessible_institution_ids(db: Session, current: User | None) -> set[int] | None:
    """
    Superadmin: sem restrição (None).
    Professor: instituições às quais está vinculado — obtidas em 1 query UNION.
    """
    if current is None or _is_superadmin(current):
        return None
    if not current.professor_id:
        return set()

    from_pi = (
        db.query(ProfessorInstitution.institution_id)
        .filter(
            ProfessorInstitution.professor_id == current.professor_id,
            ProfessorInstitution.institution_id.isnot(None),
        )
    )
    from_pg = (
        db.query(ProfessorGroup.institution_id)
        .filter(
            ProfessorGroup.professor_id == current.professor_id,
            ProfessorGroup.institution_id.isnot(None),
        )
    )
    rows = from_pi.union(from_pg).all()
    return {int(r[0]) for r in rows}


def _stats_global(db: Session, hide_superadmin_count: bool, current: User = None) -> dict:
    """Estatísticas globais; se hide_superadmin_count, não expõe quantidade de superadmins."""
    institution_ids = _accessible_institution_ids(db, current)

    if institution_ids is None:
        if hide_superadmin_count:
            role_counts = (
                db.query(User.role, func.count(User.id))
                .filter(User.role != "superadmin")
                .group_by(User.role)
                .all()
            )
            by_role = {role: cnt for role, cnt in role_counts}
            users_by_role = {
                "superadmin": 0,
                "professor":  by_role.get("professor", 0),
                "researcher": by_role.get("researcher", 0),
            }
        else:
            role_counts = db.query(User.role, func.count(User.id)).group_by(User.role).all()
            by_role = {role: cnt for role, cnt in role_counts}
            users_by_role = {
                "superadmin": by_role.get("superadmin", 0),
                "professor":  by_role.get("professor", 0),
                "researcher": by_role.get("researcher", 0),
            }
        researchers = (
            db.query(func.count(Researcher.id))
            .join(User, User.researcher_id == Researcher.id)
            .filter(User.ativo.is_(True))
            .scalar() or 0
        )
        pending = (
            db.query(func.count(Researcher.id))
            .join(User, User.researcher_id == Researcher.id)
            .filter(User.ativo.is_(True), User.password_hash.is_(None))
            .scalar() or 0
        )
        total_reminders = db.query(func.count(Reminder.id)).scalar()
        total_tips = db.query(func.count(Tip.id)).scalar()
        total_notes = db.query(func.count(Note.id)).scalar()
    else:
        if not institution_ids:
            users_by_role = {"superadmin": 0, "professor": 0, "researcher": 0}
            researchers = 0
            pending = 0
            total_reminders = 0
            total_tips = 0
            total_notes = 0
        else:
            # Usuários visíveis por instituição:
            # - Professores com vínculo em professor_institutions
            # - Alunos (e superadmin com perfil de pesquisador) pelo grupo do pesquisador
            visible_users = (
                db.query(User.id, User.role)
                .outerjoin(Professor, Professor.id == User.professor_id)
                .outerjoin(ProfessorInstitution, ProfessorInstitution.professor_id == Professor.id)
                .outerjoin(Researcher, Researcher.id == User.researcher_id)
                .outerjoin(ResearchGroup, ResearchGroup.id == Researcher.group_id)
                .filter(
                    or_(
                        ProfessorInstitution.institution_id.in_(institution_ids),
                        ResearchGroup.institution_id.in_(institution_ids),
                    )
                )
                .distinct()
                .all()
            )
            users_by_role = {"superadmin": 0, "professor": 0, "researcher": 0}
            for _, role in visible_users:
                if role == "superadmin":
                    continue
                users_by_role[role] = users_by_role.get(role, 0) + 1

            researchers = (
                db.query(func.count(Researcher.id))
                .join(User, User.researcher_id == Researcher.id)
                .filter(
                    User.ativo.is_(True),
                    Researcher.group_id.isnot(None),
                    Researcher.group.has(ResearchGroup.institution_id.in_(institution_ids)),
                ).scalar() or 0
            )
            pending = (
                db.query(func.count(Researcher.id))
                .join(User, User.researcher_id == Researcher.id)
                .filter(
                    User.ativo.is_(True),
                    User.password_hash.is_(None),
                    Researcher.group_id.isnot(None),
                    Researcher.group.has(ResearchGroup.institution_id.in_(institution_ids)),
                ).scalar() or 0
            )
            total_reminders = db.query(func.count(Reminder.id)).filter(
                Reminder.institution_id.in_(institution_ids)
            ).scalar()
            total_tips = db.query(func.count(Tip.id)).filter(
                Tip.institution_id.in_(institution_ids)
            ).scalar()
            visible_user_ids = [uid for uid, _ in visible_users]
            total_notes = db.query(func.count(Note.id)).filter(
                Note.user_id.in_(visible_user_ids)
            ).scalar()

    return {
        "users_by_role":        users_by_role,
        "total_researchers":    researchers,
        "total_pending":        pending,
        "total_groups":         _count_groups(db, current),
        "total_reminders":      total_reminders,
        "total_tips":           total_tips,
        "total_notes":          total_notes,
    }


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(db: Session = Depends(get_db), current: User = Depends(require_dashboard)):
    # Superadmin: tudo. Professor/admin: totais globais, mas sem revelar quantos superadmins existem.
    return _stats_global(db, hide_superadmin_count=not _is_superadmin(current), current=current)


# ── Users list ────────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(db: Session = Depends(get_db), current: User = Depends(require_dashboard)):
    def _institutions_for_user(u: User) -> list:
        if u.professor:
            return [pi.institution.name for pi in u.professor.professor_institutions if pi.institution]
        if u.researcher and u.researcher.group and u.researcher.group.institution:
            return [u.researcher.group.institution.name]
        return []

    def _serialize_user(u: User) -> dict:
        return {
            "id": u.id,
            "email": u.email,
            "nome": u.nome,
            "role": u.role,
            "is_admin": u.role == "superadmin",
            "researcher_id": u.researcher_id,
            "researcher_nome": u.nome if u.researcher else None,
            "researcher_status": u.researcher.status if u.researcher else None,
            "whatsapp": u.whatsapp,
            "photo_url": u.photo_thumb_url or u.photo_url,
            "last_login": u.last_login,
            "created_at": u.created_at,
            "pending": u.password_hash is None,
            "institutions": _institutions_for_user(u),
        }

    eager_opts = [
        joinedload(User.researcher).joinedload(Researcher.group).joinedload(ResearchGroup.institution),
        joinedload(User.professor).joinedload(Professor.professor_institutions).joinedload(ProfessorInstitution.institution),
    ]
    institution_ids = _accessible_institution_ids(db, current)

    if _is_superadmin(current):
        users = (
            db.query(User)
            .options(*eager_opts)
            .all()
        )
    else:
        if institution_ids:
            # Professor: apenas usuários das instituições vinculadas
            # - exclui superadmin "puro" (sem researcher)
            # Subquery: professores vinculados às instituições do professor logado
            orientador_prof_ids = (
                db.query(ProfessorInstitution.professor_id)
                .filter(ProfessorInstitution.institution_id.in_(institution_ids))
                .subquery()
            )
            users = (
                db.query(User)
                .options(*eager_opts)
                .outerjoin(Professor, Professor.id == User.professor_id)
                .outerjoin(ProfessorInstitution, ProfessorInstitution.professor_id == Professor.id)
                .outerjoin(Researcher, Researcher.id == User.researcher_id)
                .outerjoin(ResearchGroup, ResearchGroup.id == Researcher.group_id)
                .filter(
                    or_(
                        ProfessorInstitution.institution_id.in_(institution_ids),
                        ResearchGroup.institution_id.in_(institution_ids),
                        and_(Researcher.group_id.is_(None), Researcher.orientador_id.in_(select(orientador_prof_ids))),
                    )
                )
                .filter(
                    or_(
                        User.role != "superadmin",
                        and_(User.role == "superadmin", User.researcher_id.isnot(None)),
                    )
                )
                .distinct()
                .all()
            )
        else:
            users = []

        # Garante que o próprio professor logado sempre aparece na lista
        seen_ids = {u.id for u in users}
        if current.id not in seen_ids:
            self_user = (
                db.query(User)
                .options(*eager_opts)
                .filter(User.id == current.id)
                .first()
            )
            if self_user:
                users = [self_user] + list(users)

    def _user_sort_key(u: User) -> tuple:
        # Pendentes (sem senha) vão para o final
        pending = u.password_hash is None
        role_rank = _ADMIN_USER_LIST_ROLE_ORDER.get(u.role, 99)
        return (pending, role_rank, (u.nome or "").strip().lower())

    users_sorted = sorted(users, key=_user_sort_key)
    return [_serialize_user(u) for u in users_sorted]


# ── Role update (superadmin only) ─────────────────────────────────────────────

@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    data: UserRoleUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(require_superadmin),
):
    if user_id == current.id:
        raise HTTPException(status_code=400, detail="Você não pode alterar o próprio perfil")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Perfil inválido")

    old_role = user.role
    user.role = data.role

    # Gerencia FKs atomicamente ao mudar de role (mantém consistência com chk_users_no_dual_fk)
    if data.role == "researcher":
        # researcher não deve ter professor_id
        user.professor_id = None
    elif data.role == "professor":
        # professor não deve ter researcher_id
        user.researcher_id = None
    elif data.role == "superadmin":
        # superadmin é um papel puro — sem perfil vinculado
        user.professor_id = None
        user.researcher_id = None

    if data.role == "researcher":
        clear_plan(user)
    elif data.role in ("professor", "superadmin") and old_role not in ("professor", "superadmin"):
        ensure_professor_plan_defaults(user)

    db.commit()
    logger.warning("Role alterado: user_id=%s %s → %s por admin_id=%s", user.id, old_role, user.role, current.id)
    return {"id": user.id, "role": user.role, "is_admin": user.role == "superadmin"}


# ── Invite professor ────────────────────────────────────────────────────────

class InviteProfessorRequest(BaseModel):
    nome: str
    email: str
    institution_id: int | None = None


@router.post("/invite-professor", status_code=201)
def invite_professor(
    data: InviteProfessorRequest,
    db: Session = Depends(get_db),
    current: User = Depends(require_dashboard),
):
    if is_public_email_domain(data.email.strip()):
        raise HTTPException(status_code=400, detail="Professores devem usar e-mail institucional da universidade. E-mails públicos (Gmail, Hotmail, etc.) não são aceitos.")
    if db.query(User).filter(func.lower(User.email) == data.email.strip().lower()).first():
        raise HTTPException(status_code=409, detail="Email já cadastrado")

    professor = Professor()
    db.add(professor)
    db.flush()

    # Resolve instituição: usa a informada ou herda do professor que está convidando
    institution_id = data.institution_id
    if not institution_id and current.professor_id:
        origin_pi = db.query(ProfessorInstitution).filter(
            ProfessorInstitution.professor_id == current.professor_id
        ).first()
        if origin_pi:
            institution_id = origin_pi.institution_id

    if institution_id:
        pi = ProfessorInstitution(professor_id=professor.id, institution_id=institution_id, institutional_email=data.email.strip())
        db.add(pi)

        # Vincula ao grupo da instituição (cria se não existir)
        group = db.query(ResearchGroup).filter(ResearchGroup.institution_id == institution_id).first()
        if not group:
            group = ResearchGroup(name="Grupo Principal", institution_id=institution_id)
            db.add(group)
            db.flush()
        db.add(ProfessorGroup(
            professor_id=professor.id,
            group_id=group.id,
            role_in_group="coordinator",
            institution_id=institution_id,
        ))

    user = User(
        email=data.email.strip(),
        nome=data.nome.strip(),
        password_hash=None,
        role="professor",
        professor_id=professor.id,
    )
    db.add(user)
    db.flush()

    milestone = Milestone(
        user_id=user.id,
        type="entrada",
        title="Entrada no Alumnus",
        date=user.created_at.date(),
        created_by_id=user.id,
    )
    db.add(milestone)

    ensure_professor_plan_defaults(user)
    db.commit()

    logger.info("Professor convidado: email=%s professor_id=%s por admin_id=%s", data.email, professor.id, current.id)
    return {"id": user.id, "email": user.email, "nome": user.nome, "role": user.role}


# ── Delete user (superadmin only) ─────────────────────────────────────────────

@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(require_dashboard),
):
    if user_id == current.id:
        raise HTTPException(status_code=400, detail="Você não pode remover a própria conta")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if user.role == "superadmin" and current.role != "superadmin":
        raise HTTPException(status_code=403, detail="Apenas superadmin pode remover outro superadmin")
    if user.professor_id:
        count = db.query(Researcher).filter(Researcher.orientador_id == user.professor_id).count()
        if count > 0:
            raise HTTPException(status_code=400, detail=f"Este professor possui {count} aluno(s) vinculado(s). Remova ou reatribua os alunos antes de excluir.")
    # Nullify FK references to avoid integrity errors
    logger.warning("Usuário removido: user_id=%s email=%s role=%s por admin_id=%s", user.id, user.email, user.role, current.id)
    db.query(Note).filter(Note.created_by_id == user_id).update({"created_by_id": None})
    db.query(Reminder).filter(Reminder.created_by_id == user_id).update({"created_by_id": None})
    db.query(Tip).filter(Tip.author_id == user_id).update({"author_id": None})
    db.query(TipComment).filter(TipComment.author_id == user_id).update({"author_id": None})
    db.query(UserPlan).filter(UserPlan.user_id == user_id).delete()
    db.query(Milestone).filter(Milestone.user_id == user_id).delete()
    professor_id = user.professor_id
    db.delete(user)
    # Remove professor órfão (cascade limpa professor_institutions/groups)
    if professor_id:
        prof = db.query(Professor).filter(Professor.id == professor_id).first()
        if prof:
            db.delete(prof)
    db.commit()


# ── Bulk delete (superadmin only) ─────────────────────────────────────────────

@router.post("/bulk-delete", status_code=204)
def bulk_delete(
    data: BulkDeleteRequest,
    db: Session = Depends(get_db),
    current: User = Depends(require_dashboard),
):
    deleted_ids = []
    for uid in data.user_ids:
        if uid == current.id:
            continue
        user = db.query(User).filter(User.id == uid).first()
        if user and not (user.role == "superadmin" and current.role != "superadmin"):
            deleted_ids.append(uid)
            db.query(Note).filter(Note.created_by_id == uid).update({"created_by_id": None})
            db.query(Reminder).filter(Reminder.created_by_id == uid).update({"created_by_id": None})
            db.query(Tip).filter(Tip.author_id == uid).update({"author_id": None})
            db.query(TipComment).filter(TipComment.author_id == uid).update({"author_id": None})
            db.delete(user)
    pending_deleted = []
    for rid in data.researcher_ids:
        # researcher_ids: compatibilidade — encontra via user vinculado
        user = db.query(User).filter(User.researcher_id == rid).first()
        if user and user.password_hash is None:
            pending_deleted.append(rid)
            researcher = db.query(Researcher).filter(Researcher.id == rid).first()
            db.query(Note).filter(Note.created_by_id == user.id).update({"created_by_id": None})
            db.delete(user)
            if researcher:
                db.delete(researcher)
    if deleted_ids or pending_deleted:
        logger.warning(
            "Bulk delete por admin_id=%s: %d usuários removidos (ids=%s), %d pesquisadores pendentes (ids=%s)",
            current.id, len(deleted_ids), deleted_ids, len(pending_deleted), pending_deleted,
        )
    db.commit()


# ── Delete pending researcher ──────────────────────────────────────────────────

@router.delete("/researchers/{researcher_id}", status_code=204)
def delete_pending_researcher(
    researcher_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_dashboard),
):
    researcher = db.query(Researcher).filter(Researcher.id == researcher_id).first()
    if not researcher:
        raise HTTPException(status_code=404, detail="Pesquisador não encontrado")
    user = db.query(User).filter(User.researcher_id == researcher_id).first()
    if user and user.password_hash is not None:
        raise HTTPException(status_code=400, detail="Pesquisador já possui conta ativa — remova o usuário")
    if user:
        db.query(Note).filter(Note.created_by_id == user.id).update({"created_by_id": None})
        db.delete(user)
    if researcher:
        db.delete(researcher)
    db.commit()
