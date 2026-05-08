import os
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from passlib.context import CryptContext
from jose import jwt
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import RegisterRequest, LoginRequest, TokenOut, UserOut
from ..plan import ensure_professor_plan_defaults, refresh_user_plan_status, user_to_out
from ..deps import get_current_user, SECRET_KEY, ALGORITHM
from ..services import auth_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
EXPIRE_H = int(os.getenv("TOKEN_EXPIRE_HOURS", "168"))


def make_token(user: User) -> str:
    payload = {
        "sub":           str(user.id),
        "nome":          user.nome,
        "email":         user.email,
        "role":          user.role,
        "is_admin":      user.role == "superadmin",
        "professor_id":  user.professor_id,
        "researcher_id": user.researcher_id,
        "exp":           datetime.utcnow() + timedelta(hours=EXPIRE_H),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


@router.post("/register", response_model=UserOut, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """Ativa conta de um usuário convidado: define a senha pela primeira vez."""
    user = auth_service.activate_account(db, data, pwd_ctx)
    return user_to_out(user)


@router.post("/login", response_model=TokenOut)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = auth_service.authenticate(db, data.email, data.password, pwd_ctx)
    if not user:
        logger.warning("Login falhou: email=%s", data.email)
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    auth_service.record_login(db, user)
    refresh_user_plan_status(db, user)
    if ensure_professor_plan_defaults(user):
        db.commit()
    logger.info("Login bem-sucedido: user_id=%s email=%s role=%s", user.id, user.email, user.role)
    return TokenOut(access_token=make_token(user))


@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    refresh_user_plan_status(db, current)
    if ensure_professor_plan_defaults(current):
        db.commit()
    db.refresh(current)
    return user_to_out(current)
