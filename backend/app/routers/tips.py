from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import (
    TipCreate,
    TipOut,
    TipCommentCreate,
    TipCommentOut,
)
from ..deps import get_current_user, is_privileged
from ..services import tip_service

router = APIRouter(prefix="/tips", tags=["tips"])


@router.get("/", response_model=list[TipOut])
def list_tips(
    institution_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entries = tip_service.list_tips(db, institution_id)
    return [TipOut.from_orm_with_context(e, current_user.id) for e in entries]


@router.get("/{entry_id}", response_model=TipOut)
def get_tip(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = tip_service.get_tip_full(db, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return TipOut.from_orm_with_context(entry, current_user.id)


@router.post("/", response_model=TipOut)
def create_tip(
    data: TipCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = tip_service.create_tip(db, data, current_user.id)
    return TipOut.from_orm_with_context(entry, current_user.id)


@router.delete("/{entry_id}")
def delete_tip(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = tip_service.get_tip(db, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    is_author = entry.author_id is not None and entry.author_id == current_user.id
    if not is_author and not is_privileged(current_user):
        raise HTTPException(
            status_code=403,
            detail="Só o autor ou um moderador (professor, admin ou superadmin) pode remover a entrada",
        )
    tip_service.delete_tip(db, entry)
    return {"status": "ok"}


@router.post("/{entry_id}/vote")
def toggle_vote(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = tip_service.get_tip(db, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    voted, vote_count = tip_service.toggle_vote(db, entry, current_user.id)
    return {"voted": voted, "vote_count": vote_count}


@router.post("/{entry_id}/comments", response_model=TipCommentOut)
def add_comment(
    entry_id: int,
    data: TipCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = tip_service.get_tip(db, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    comment = tip_service.add_comment(db, entry_id, data.text, current_user.id)
    return TipCommentOut.from_orm_with_author(comment)


@router.delete("/comments/{comment_id}")
def delete_tip_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = tip_service.get_tip_comment(db, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    is_author = comment.author_id is not None and comment.author_id == current_user.id
    if not is_author and not is_privileged(current_user):
        raise HTTPException(
            status_code=403,
            detail="Só o autor ou um moderador (professor, admin ou superadmin) pode remover o comentário",
        )
    tip_service.delete_tip_comment(db, comment)
    return {"status": "ok"}
