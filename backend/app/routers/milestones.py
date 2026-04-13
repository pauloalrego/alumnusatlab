import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Milestone, User
from ..schemas import MilestoneCreate, MilestoneOut, MilestoneUpdate
from ..services import milestone_service
from ..services.user_service import get_by_id as get_user_by_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users/{user_id}/milestones", tags=["milestones"])


def _get_user_or_404(user_id: int, db: Session) -> User:
    u = get_user_by_id(db, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return u


def _check_can_edit(current_user: User, user_id: int):
    is_own = current_user.id == user_id
    if current_user.role not in ("professor", "superadmin") and not is_own:
        raise HTTPException(status_code=403, detail="Sem permissão para editar marcos deste usuário")


def _check_date_after_entrada(db: Session, user_id: int, new_date):
    """Rejeita datas anteriores ao milestone de entrada no Alumnus."""
    if new_date is None:
        return
    entrada = (
        db.query(Milestone)
        .filter(Milestone.user_id == user_id, Milestone.type == "entrada")
        .first()
    )
    if entrada and new_date < entrada.date:
        raise HTTPException(
            status_code=422,
            detail="A data não pode ser anterior à entrada no Alumnus",
        )


@router.get("/", response_model=list[MilestoneOut])
def list_milestones(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_user_or_404(user_id, db)
    return milestone_service.list_by_user(db, user_id)


@router.post("/", response_model=MilestoneOut, status_code=201)
def create_milestone(
    user_id: int,
    data: MilestoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_user_or_404(user_id, db)
    _check_can_edit(current_user, user_id)
    _check_date_after_entrada(db, user_id, data.date)
    return milestone_service.create(db, user_id, data, current_user.id)


@router.put("/{milestone_id}", response_model=MilestoneOut)
def update_milestone(
    user_id: int,
    milestone_id: int,
    data: MilestoneUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_user_or_404(user_id, db)
    _check_can_edit(current_user, user_id)
    milestone = milestone_service.get_by_id(db, milestone_id)
    if not milestone or milestone.user_id != user_id:
        raise HTTPException(status_code=404, detail="Marco não encontrado")
    _check_date_after_entrada(db, user_id, data.date)
    return milestone_service.update(db, milestone, data)


@router.delete("/{milestone_id}", status_code=204)
def delete_milestone(
    user_id: int,
    milestone_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_user_or_404(user_id, db)
    _check_can_edit(current_user, user_id)
    milestone = milestone_service.get_by_id(db, milestone_id)
    if not milestone or milestone.user_id != user_id:
        raise HTTPException(status_code=404, detail="Marco não encontrado")
    milestone_service.delete(db, milestone)
