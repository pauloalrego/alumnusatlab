"""
Shared pytest fixtures for the Alumnus backend test suite.

Uses SQLite in-memory via SQLAlchemy so tests run fast without PostgreSQL.
The `check_same_thread=False` connect arg is required for SQLite + SQLAlchemy.
"""

import pytest
from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import User, UserPlan, Researcher, Reminder
from app.main import app
from app.database import get_db
from passlib.context import CryptContext

SQLITE_URL = "sqlite:///:memory:"

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


@pytest.fixture(scope="function")
def engine():
    eng = create_engine(
        SQLITE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)


@pytest.fixture(scope="function")
def db(engine):
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db):
    """TestClient with the in-memory DB injected via dependency override."""

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Helper factories
# ---------------------------------------------------------------------------

def make_researcher(db, nome="Ana Silva", email="ana@univ.edu.br", ativo=True, password=None):
    """Cria um Researcher + User vinculado (password=None → conta pendente)."""
    researcher = Researcher(status="mestrado")
    db.add(researcher)
    db.flush()

    user = User(
        email=email,
        nome=nome,
        password_hash=pwd_ctx.hash(password) if password else None,
        role="researcher",
        ativo=ativo,
        researcher_id=researcher.id,
    )
    db.add(user)
    db.commit()
    db.refresh(researcher)
    return researcher


def make_user(
    db,
    email="prof@univ.edu.br",
    nome="Professor",
    role="professor",
    password="securepassword",
    researcher_id=None,
    plan_type=None,
    plan_status=None,
    account_activated_at=None,
    plan_period_ends_at=None,
):
    u = User(
        email=email,
        nome=nome,
        password_hash=pwd_ctx.hash(password),
        role=role,
        researcher_id=researcher_id,
        created_at=datetime.utcnow(),
    )
    db.add(u)
    db.flush()
    if plan_type is not None or plan_status is not None or account_activated_at is not None or plan_period_ends_at is not None:
        db.add(UserPlan(
            user_id=u.id,
            plan_type=plan_type,
            plan_status=plan_status,
            account_activated_at=account_activated_at,
            plan_period_ends_at=plan_period_ends_at,
        ))
    db.commit()
    db.refresh(u)
    return u


def make_reminder(db, text="Lembrete teste", due_date=None, done=False, created_by_id=None):
    r = Reminder(
        text=text,
        due_date=due_date,
        done=done,
        created_by_id=created_by_id,
        created_at=datetime.utcnow(),
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r
