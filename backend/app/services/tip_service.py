import logging

from sqlalchemy.orm import Session, joinedload

from ..models import TipComment, Tip, TipVote
from ..schemas import TipCreate

logger = logging.getLogger(__name__)


def list_tips(db: Session, institution_id: int | None = None) -> list[Tip]:
    q = (
        db.query(Tip)
        .options(
            joinedload(Tip.author),
            joinedload(Tip.votes),
            joinedload(Tip.comments).joinedload(TipComment.author),
        )
    )
    if institution_id is not None:
        q = q.filter(Tip.institution_id == institution_id)
    entries = q.all()
    return sorted(entries, key=lambda e: (-len(e.votes), e.created_at))


def get_tip(db: Session, entry_id: int) -> Tip | None:
    return db.query(Tip).filter(Tip.id == entry_id).first()


def get_tip_full(db: Session, entry_id: int) -> Tip | None:
    return (
        db.query(Tip)
        .options(
            joinedload(Tip.author),
            joinedload(Tip.votes),
            joinedload(Tip.comments).joinedload(TipComment.author),
        )
        .filter(Tip.id == entry_id)
        .first()
    )


def create_tip(db: Session, data: TipCreate, author_id: int) -> Tip:
    entry = Tip(
        question=data.question,
        answer=data.answer,
        position=data.position or 0,
        author_id=author_id,
        institution_id=data.institution_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    logger.info("Tip criado: id=%s author_id=%s institution_id=%s", entry.id, author_id, data.institution_id)
    return entry


def delete_tip(db: Session, entry: Tip) -> None:
    logger.info("Tip removido: id=%s author_id=%s", entry.id, entry.author_id)
    db.delete(entry)
    db.commit()


def toggle_vote(db: Session, entry: Tip, user_id: int) -> tuple[bool, int]:
    existing = (
        db.query(TipVote)
        .filter(
            TipVote.entry_id == entry.id,
            TipVote.user_id == user_id,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        voted = False
    else:
        db.add(TipVote(entry_id=entry.id, user_id=user_id))
        voted = True
    db.commit()
    db.refresh(entry)
    return voted, len(entry.votes)


def add_comment(
    db: Session, entry_id: int, text: str, author_id: int
) -> TipComment:
    comment = TipComment(entry_id=entry_id, text=text, author_id=author_id)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def get_tip_comment(db: Session, comment_id: int) -> TipComment | None:
    return db.query(TipComment).filter(TipComment.id == comment_id).first()


def delete_tip_comment(db: Session, comment: TipComment) -> None:
    db.delete(comment)
    db.commit()
