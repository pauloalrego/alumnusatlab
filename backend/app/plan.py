"""Regras de plano (trial 30 dias, mensal, anual) e mapeamento para API."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from sqlalchemy.orm import Session

from .models import Researcher, ResearchGroup, User

TRIAL_DAYS = 30

PLAN_TRIAL = "trial"
PLAN_MONTHLY = "monthly"
PLAN_ANNUAL = "annual"

STATUS_ACTIVE = "active"
STATUS_EXPIRED = "expired"


def trial_period_end(activated_at: datetime) -> datetime:
    return activated_at + timedelta(days=TRIAL_DAYS)


def _to_naive_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def now_naive_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def is_plan_user(user: User) -> bool:
    """Plano (trial/mensal/anual): professor e superadmin."""
    return user.role in ("professor", "superadmin")


def clear_plan(user: User) -> None:
    if user.plan is not None:
        user.plan.plan_type = None
        user.plan.plan_status = None
        user.plan.account_activated_at = None
        user.plan.plan_period_ends_at = None


def ensure_professor_plan_defaults(user: User) -> bool:
    """Garante trial padrão para professor/superadmin sem plano (ex.: migração ou promoção de papel)."""
    from .models import UserPlan
    if not is_plan_user(user):
        return False
    if user.plan is not None and user.plan.plan_type is not None:
        return False
    now = datetime.utcnow()
    if user.plan is None:
        user.plan = UserPlan(user_id=user.id)
    user.plan.plan_type = PLAN_TRIAL
    user.plan.plan_status = STATUS_ACTIVE
    user.plan.account_activated_at = now
    user.plan.plan_period_ends_at = None
    return True


def refresh_user_plan_status(db: Session, user: User) -> None:
    """Atualiza plan_status conforme plan_period_ends_at (quando definido)."""
    if not is_plan_user(user) or user.plan is None or user.plan.plan_period_ends_at is None:
        return
    now = now_naive_utc()
    end = _to_naive_utc(user.plan.plan_period_ends_at)
    want = STATUS_EXPIRED if now >= end else STATUS_ACTIVE
    if user.plan.plan_status != want:
        user.plan.plan_status = want
        db.commit()


def compute_trial_days_remaining(user: User) -> int | None:
    """Dias restantes do trial (0 se vencido); None se não for professor em trial."""
    if not is_plan_user(user) or user.plan is None or user.plan.plan_type != PLAN_TRIAL:
        return None
    if user.plan.plan_period_ends_at is None:
        return None
    today = date.today()
    end_d = _to_naive_utc(user.plan.plan_period_ends_at).date()
    return max(0, (end_d - today).days)


def _resolve_researcher_institution(user: User) -> tuple[int | None, str | None]:
    """Deriva institution_id/name do researcher via group, sem query extra (usa relacionamentos já carregados)."""
    if user.researcher_id is None:
        return None, None
    researcher = user.researcher
    if researcher is None or researcher.group_id is None:
        return None, None
    group = researcher.group if hasattr(researcher, "group") and researcher.group is not None else None
    if group is None:
        return None, None
    inst = group.institution if hasattr(group, "institution") and group.institution is not None else None
    if inst is None:
        return group.institution_id, None
    return inst.id, inst.name


def user_to_out(user: User) -> "UserOut":
    from .schemas import UserOut

    institution_id, institution_name = _resolve_researcher_institution(user)

    _profile = dict(
        photo_url=user.photo_url,
        photo_thumb_url=user.photo_thumb_url,
        lattes_url=user.lattes_url,
        scholar_url=user.scholar_url,
        linkedin_url=user.linkedin_url,
        github_url=user.github_url,
        instagram_url=user.instagram_url,
        twitter_url=user.twitter_url,
        whatsapp=user.whatsapp,
        interesses=user.interesses,
        bio=user.bio,
        institution_id=institution_id,
        institution_name=institution_name,
    )

    if not is_plan_user(user):
        return UserOut(
            id=user.id,
            email=user.email,
            nome=user.nome,
            role=user.role,
            professor_id=user.professor_id,
            researcher_id=user.researcher_id,
            last_login=user.last_login,
            created_at=user.created_at,
            plan_type=None,
            plan_status=None,
            account_activated_at=None,
            plan_period_ends_at=None,
            trial_days_remaining=None,
            **_profile,
        )

    return UserOut(
        id=user.id,
        email=user.email,
        nome=user.nome,
        role=user.role,
        professor_id=user.professor_id,
        researcher_id=user.researcher_id,
        last_login=user.last_login,
        created_at=user.created_at,
        plan_type=user.plan.plan_type if user.plan else None,
        plan_status=user.plan.plan_status if user.plan else None,
        account_activated_at=user.plan.account_activated_at if user.plan else None,
        plan_period_ends_at=user.plan.plan_period_ends_at if user.plan else None,
        trial_days_remaining=compute_trial_days_remaining(user),
        **_profile,
    )
