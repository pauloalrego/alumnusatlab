import logging

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, contains_eager, joinedload

from ..models import Milestone, Professor, ProfessorGroup, ProfessorInstitution, ResearchGroup, Researcher, User
from ..schemas import ResearcherCreate, ResearcherUpdate
from ..slug import slugify

logger = logging.getLogger(__name__)


def _resolve_group_id(db: Session, orientador_id: int | None, institution_id: int | None = None) -> int | None:
    """Dado um professor orientador, retorna o group_id do seu grupo principal (coordinator)."""
    if orientador_id is None:
        return None
    q = db.query(ProfessorGroup).filter(
        ProfessorGroup.professor_id == orientador_id,
        ProfessorGroup.role_in_group == "coordinator",
    )
    if institution_id is not None:
        q = q.filter(ProfessorGroup.institution_id == institution_id)
    pg = q.first()
    return pg.group_id if pg else None


def _with_user(q):
    """Aplica eager load do User vinculado via User.researcher_id."""
    return q.outerjoin(User, User.researcher_id == Researcher.id).options(
        contains_eager(Researcher.user)
    )


def list_all(db: Session, ativo: bool | None, institution_id: int | None = None) -> list[Researcher]:
    q = _with_user(db.query(Researcher))
    if ativo is not None:
        q = q.filter(User.ativo == ativo)
    if institution_id is not None:
        group_ids = select(ResearchGroup.id).where(
            ResearchGroup.institution_id == institution_id
        )
        prof_ids = select(ProfessorInstitution.professor_id).where(
            ProfessorInstitution.institution_id == institution_id
        )
        q = q.filter(
            or_(
                Researcher.group_id.in_(group_ids),
                and_(Researcher.group_id.is_(None), Researcher.orientador_id.in_(prof_ids)),
            )
        )
    results = q.order_by(User.nome).all()
    # Superadmin users são invisíveis em perfis de pesquisadores
    return [r for r in results if not (r.user and r.user.role == "superadmin")]


def create(db: Session, data: ResearcherCreate) -> Researcher:
    # Verifica duplicidade de email na tabela users
    if db.query(User).filter(func.lower(User.email) == data.email).first():
        raise HTTPException(status_code=409, detail="Email já cadastrado")

    # Resolve group_id
    institution_id = data.institution_id
    group_id = data.group_id
    if group_id is None:
        if data.orientador_id is not None:
            group_id = _resolve_group_id(db, data.orientador_id, institution_id)
        elif institution_id is not None:
            group = db.query(ResearchGroup).filter(ResearchGroup.institution_id == institution_id).first()
            group_id = group.id if group else None

    # Cria Researcher sem nome/email (ficam no User)
    researcher = Researcher(
        status=data.status,
        group_id=group_id,
        orientador_id=data.orientador_id,
    )
    db.add(researcher)
    db.flush()  # gera researcher.id antes de criar o User

    # Cria User vinculado (sem senha — conta pendente)
    user = User(
        email=data.email,
        nome=data.nome,
        password_hash=None,
        role="researcher",
        researcher_id=researcher.id,
    )
    db.add(user)
    db.flush()  # gera user.id antes de criar o milestone

    milestone = Milestone(
        user_id=user.id,
        type="entrada",
        title="Entrada no Alumnus",
        date=user.created_at.date(),
        created_by_id=user.id,
    )
    db.add(milestone)
    db.commit()

    logger.info("Researcher+User created: %s (researcher_id=%s)", data.email, researcher.id)
    return get_by_id(db, researcher.id)


def get_by_id(db: Session, researcher_id: int) -> Researcher | None:
    return (
        _with_user(db.query(Researcher))
        .filter(Researcher.id == researcher_id)
        .first()
    )


def find_by_slug(db: Session, slug: str) -> Researcher | None:
    researchers = (
        _with_user(db.query(Researcher))
        .filter(User.ativo == True)
        .all()
    )
    for r in researchers:
        if r.user and slugify(r.user.nome) == slug:
            return r
    return None


def get_linked_user(db: Session, researcher_id: int) -> User | None:
    return db.query(User).filter(User.researcher_id == researcher_id).first()


def update(db: Session, researcher: Researcher, data: ResearcherUpdate) -> Researcher:
    payload = data.model_dump(exclude_unset=True)

    # Quando orientador muda, atualiza group_id automaticamente
    if "orientador_id" in payload and "group_id" not in payload:
        payload["group_id"] = _resolve_group_id(db, payload["orientador_id"])

    for key, value in payload.items():
        setattr(researcher, key, value)
    db.commit()
    logger.info("Researcher updated: id=%s", researcher.id)
    return get_by_id(db, researcher.id)


def deactivate(db: Session, researcher: Researcher) -> None:
    researcher.ativo = False
    db.commit()
    logger.info("Researcher deactivated: id=%s", researcher.id)
