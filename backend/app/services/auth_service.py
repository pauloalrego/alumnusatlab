import logging
from datetime import datetime

from fastapi import HTTPException
from passlib.context import CryptContext
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import User
from ..schemas import RegisterRequest
from ..services import activity_service

logger = logging.getLogger(__name__)


def _norm_email(email: str) -> str:
    return (email or "").strip().lower()


def user_email_exists(db: Session, email: str) -> bool:
    e = _norm_email(email)
    return (
        db.query(User).filter(func.lower(User.email) == e).first() is not None
    )


def activate_account(
    db: Session,
    data: RegisterRequest,
    pwd_ctx: CryptContext,
) -> User:
    """Define a senha de um User pendente (convidado mas sem senha)."""
    e = _norm_email(data.email)
    user = db.query(User).filter(func.lower(User.email) == e).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="Email não encontrado. Entre em contato com seu orientador.",
        )
    # Bloqueia ativação se o usuário foi inativado
    if not user.ativo:
        raise HTTPException(
            status_code=404,
            detail="Email não encontrado. Entre em contato com seu orientador.",
        )
    if user.password_hash is not None:
        raise HTTPException(
            status_code=409,
            detail="Esta conta já está ativa. Use o login.",
        )
    user.password_hash = pwd_ctx.hash(data.password)
    db.commit()
    db.refresh(user)
    logger.info("Account activated: %s", user.email)
    return user


def authenticate(
    db: Session, email: str, password: str, pwd_ctx: CryptContext
) -> User | None:
    e = _norm_email(email)
    user = db.query(User).filter(func.lower(User.email) == e).first()
    if not user or user.password_hash is None:
        return None
    if not pwd_ctx.verify(password, user.password_hash):
        return None
    return user


def record_login(db: Session, user: User) -> None:
    user.last_login = datetime.utcnow()
    activity_service.log(
        db,
        actor_id=user.id,
        target_user_id=user.id,
        action="login",
        entity_type="user",
        entity_id=user.id,
    )
    db.commit()
