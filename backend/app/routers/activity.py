import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_professor, get_current_user
from ..models import ActivityEvent, Milestone, Note, Reading, Researcher, User
from ..schemas import ActivityEventOut
from ..services import activity_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/activity", tags=["activity"])


def _get_orientando_user_ids(db: Session, professor_id: int) -> list[int]:
    researchers = (
        db.query(Researcher)
        .filter(Researcher.orientador_id == professor_id)
        .all()
    )
    user_ids = []
    for r in researchers:
        if r.user:
            user_ids.append(r.user.id)
    return user_ids


@router.get("/my-researchers", response_model=list[ActivityEventOut])
def list_my_researchers_activity(
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor),
):
    if not current_user.professor_id:
        return []
    user_ids = _get_orientando_user_ids(db, current_user.professor_id)
    if not user_ids:
        return []
    events = activity_service.list_by_target_users(db, user_ids, limit)
    return [ActivityEventOut.from_orm_with_names(e) for e in events]


@router.get("/user/{user_id}", response_model=list[ActivityEventOut])
def list_user_activity(
    user_id: int,
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_own = current_user.id == user_id
    if not is_own and current_user.role not in ("professor", "superadmin"):
        raise HTTPException(status_code=403, detail="Sem permissao")
    events = activity_service.list_by_target_user(db, user_id, limit, offset)
    return [ActivityEventOut.from_orm_with_names(e) for e in events]


@router.get("/user/{user_id}/stats")
def get_user_stats(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_own = current_user.id == user_id
    if not is_own and current_user.role not in ("professor", "superadmin"):
        raise HTTPException(status_code=403, detail="Sem permissao")

    readings_sub = db.query(func.count(Reading.id)).filter(Reading.user_id == user_id).scalar_subquery()
    milestones_sub = db.query(func.count(Milestone.id)).filter(Milestone.user_id == user_id).scalar_subquery()
    notes_sub = db.query(func.count(Note.id)).filter(Note.user_id == user_id).scalar_subquery()
    logins_sub = db.query(func.count(ActivityEvent.id)).filter(
        ActivityEvent.target_user_id == user_id, ActivityEvent.action == "login"
    ).scalar_subquery()

    readings, milestones, notes, logins = db.query(
        readings_sub, milestones_sub, notes_sub, logins_sub
    ).one()

    # Score de engajamento (últimos 30 dias)
    since = datetime.utcnow() - timedelta(days=30)
    recent_events = (
        db.query(ActivityEvent)
        .filter(
            ActivityEvent.target_user_id == user_id,
            ActivityEvent.created_at >= since,
        )
        .all()
    )
    engagement_score = _compute_engagement_score(recent_events)

    return {
        "readings": readings,
        "milestones": milestones,
        "notes": notes,
        "logins": logins,
        "engagement_score": engagement_score,
    }


_ACTION_WEIGHTS = {
    "reading_created": 5,
    "reading_status_changed_lido": 8,
    "reading_status_changed_other": 1,
    "milestone_created": 6,
    "milestone_updated": 1,
    "note_created": 3,
    "note_updated": 1,
}


def _compute_engagement_score(events: list[ActivityEvent]) -> int:
    if not events:
        return 0

    # Frequência (0-40): dias distintos com atividade
    active_days = len({e.created_at.date() for e in events})
    frequency = min(40, round((active_days / 15) * 40))

    # Produção (0-40): soma ponderada de ações
    production_raw = 0
    for e in events:
        if e.action == "reading_created":
            production_raw += _ACTION_WEIGHTS["reading_created"]
        elif e.action == "reading_status_changed":
            meta = e.metadata_json or {}
            production_raw += _ACTION_WEIGHTS["reading_status_changed_lido"] if meta.get("to") == "lido" else _ACTION_WEIGHTS["reading_status_changed_other"]
        elif e.action == "milestone_created":
            production_raw += _ACTION_WEIGHTS["milestone_created"]
        elif e.action == "milestone_updated":
            production_raw += _ACTION_WEIGHTS["milestone_updated"]
        elif e.action == "note_created":
            production_raw += _ACTION_WEIGHTS["note_created"]
        elif e.action == "note_updated":
            production_raw += _ACTION_WEIGHTS["note_updated"]
    production = min(40, production_raw)

    # Recência (0-20): última ação produtiva
    non_login = [e for e in events if e.action != "login"]
    recency = 0
    if non_login:
        last = max(non_login, key=lambda e: e.created_at)
        days_ago = (datetime.utcnow() - last.created_at).days
        if days_ago <= 0:
            recency = 20
        elif days_ago <= 3:
            recency = 15
        elif days_ago <= 7:
            recency = 10
        elif days_ago <= 14:
            recency = 5

    return frequency + production + recency
