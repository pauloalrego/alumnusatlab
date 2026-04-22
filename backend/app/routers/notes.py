import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from ..database import get_db, SessionLocal
from ..models import User
from ..schemas import NoteOut
from ..deps import get_current_user
from ..services import note_service, upload_service
from ..services.note_notifications import send_note_notifications

logger = logging.getLogger(__name__)
router = APIRouter(tags=["notes"])


@router.get("/users/{user_id}/notes", response_model=list[NoteOut])
def list_notes(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("professor", "admin", "superadmin") and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Sem permissão")
    notes = note_service.list_by_user(db, user_id)
    return [NoteOut.from_orm_with_creator(n) for n in notes]


@router.post("/users/{user_id}/notes", response_model=NoteOut, status_code=201)
async def create_note(
    user_id: int,
    background_tasks: BackgroundTasks,
    text: str = Form(...),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("professor", "admin", "superadmin") and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Sem permissão")

    file_url, file_name = None, None
    if file and file.filename:
        file_url, file_name = await upload_service.save_upload(file, db)

    note = note_service.create(
        db,
        user_id=user_id,
        text=text,
        file_url=file_url,
        file_name=file_name,
        created_by_id=current_user.id,
    )
    background_tasks.add_task(
        send_note_notifications,
        note.text,
        user_id,
        current_user.email,
        current_user.nome,
        SessionLocal,
    )
    return NoteOut.from_orm_with_creator(note)


@router.put("/notes/{note_id}", response_model=NoteOut)
def update_note(
    note_id: int,
    text: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = note_service.get_by_id(db, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if current_user.role not in ("professor", "admin", "superadmin") and note.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sem permissão para editar esta anotação")
    note = note_service.update(db, note, text)
    return NoteOut.from_orm_with_creator(note)


@router.delete("/notes/{note_id}", status_code=204)
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = note_service.get_by_id(db, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if current_user.role not in ("professor", "admin", "superadmin") and note.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Você só pode remover suas próprias anotações")
    note_service.delete(db, note)
