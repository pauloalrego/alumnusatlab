import logging
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..models import ActivityEvent

logger = logging.getLogger(__name__)


def log(
    db: Session,
    *,
    actor_id: int,
    target_user_id: int,
    action: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
    metadata: dict | None = None,
):
    event = ActivityEvent(
        actor_id=actor_id,
        target_user_id=target_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata_json=metadata,
    )
    db.add(event)


def list_by_target_user(db: Session, user_id: int, limit: int = 50) -> list[ActivityEvent]:
    return (
        db.query(ActivityEvent)
        .options(joinedload(ActivityEvent.actor))
        .filter(ActivityEvent.target_user_id == user_id)
        .order_by(ActivityEvent.created_at.desc())
        .limit(limit)
        .all()
    )


def list_by_target_users(db: Session, user_ids: list[int], limit: int = 100) -> list[ActivityEvent]:
    return (
        db.query(ActivityEvent)
        .options(joinedload(ActivityEvent.actor), joinedload(ActivityEvent.target_user))
        .filter(ActivityEvent.target_user_id.in_(user_ids))
        .order_by(ActivityEvent.created_at.desc())
        .limit(limit)
        .all()
    )


def summary_by_user(db: Session, user_id: int, days: int = 30) -> dict:
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(ActivityEvent.action, func.count())
        .filter(
            ActivityEvent.target_user_id == user_id,
            ActivityEvent.created_at >= since,
        )
        .group_by(ActivityEvent.action)
        .all()
    )
    return {action: count for action, count in rows}
