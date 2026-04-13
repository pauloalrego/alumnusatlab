import logging
from typing import Optional

from sqlalchemy.orm import Session

from ..models import Note
from ..services import activity_service

logger = logging.getLogger(__name__)


def list_by_user(db: Session, user_id: int) -> list[Note]:
    return db.query(Note).filter(Note.user_id == user_id).order_by(Note.created_at.desc()).all()


def create(
    db: Session,
    user_id: int,
    text: str,
    file_url: Optional[str],
    file_name: Optional[str],
    created_by_id: Optional[int],
) -> Note:
    note = Note(
        user_id=user_id,
        text=text,
        file_url=file_url,
        file_name=file_name,
        created_by_id=created_by_id,
    )
    db.add(note)
    db.flush()
    activity_service.log(
        db,
        actor_id=created_by_id or user_id,
        target_user_id=user_id,
        action="note_created",
        entity_type="note",
        entity_id=note.id,
    )
    db.commit()
    db.refresh(note)
    logger.info("Note created for user %s", user_id)
    return note


def get_by_id(db: Session, note_id: int) -> Note | None:
    return db.query(Note).get(note_id)


def update(db: Session, note: Note, text: str) -> Note:
    note.text = text
    activity_service.log(
        db,
        actor_id=note.created_by_id or note.user_id,
        target_user_id=note.user_id,
        action="note_updated",
        entity_type="note",
        entity_id=note.id,
    )
    db.commit()
    db.refresh(note)
    logger.info("Note updated: id=%s", note.id)
    return note


def delete(db: Session, note: Note) -> None:
    db.delete(note)
    db.commit()
    logger.info("Note deleted: id=%s", note.id)
