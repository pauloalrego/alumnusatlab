import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_professor, get_current_user
from ..models import Researcher, User
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_own = current_user.id == user_id
    if not is_own and current_user.role not in ("professor", "superadmin"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Sem permissao")
    events = activity_service.list_by_target_user(db, user_id, limit)
    return [ActivityEventOut.from_orm_with_names(e) for e in events]
