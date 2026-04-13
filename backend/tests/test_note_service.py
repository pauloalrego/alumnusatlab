"""Tests for app/services/note_service.py"""
import pytest
from passlib.context import CryptContext

from app.models import Institution, User
from app.services import note_service

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def make_user(db, email="user@test.br", role="researcher"):
    u = User(
        email=email,
        nome="Test User",
        password_hash=pwd_ctx.hash("pass"),
        role=role,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def make_institution(db, name="TEST_INST", domain="testinst.br"):
    inst = Institution(name=name, domain=domain)
    db.add(inst)
    db.commit()
    db.refresh(inst)
    return inst


class TestCreate:
    def test_creates_note(self, db):
        user = make_user(db)
        note = note_service.create(
            db,
            user_id=user.id,
            text="Texto da nota",
            file_url=None,
            file_name=None,
            created_by_id=user.id,
        )
        assert note.id is not None
        assert note.text == "Texto da nota"
        assert note.user_id == user.id
        assert note.created_by_id == user.id

    def test_creates_note_with_file(self, db):
        user = make_user(db, "file@test.br")
        note = note_service.create(
            db,
            user_id=user.id,
            text="Com arquivo",
            file_url="/files/1",
            file_name="doc.pdf",
            created_by_id=user.id,
        )
        assert note.file_url == "/files/1"
        assert note.file_name == "doc.pdf"


class TestListByUser:
    def test_returns_notes_for_user(self, db):
        user = make_user(db, "list@test.br")
        note_service.create(db, user_id=user.id, text="Nota 1", file_url=None, file_name=None, created_by_id=user.id)
        note_service.create(db, user_id=user.id, text="Nota 2", file_url=None, file_name=None, created_by_id=user.id)
        notes = note_service.list_by_user(db, user.id)
        assert len(notes) == 2

    def test_does_not_return_other_users_notes(self, db):
        user1 = make_user(db, "user1@test.br")
        user2 = make_user(db, "user2@test.br")
        note_service.create(db, user_id=user1.id, text="User1 Note", file_url=None, file_name=None, created_by_id=user1.id)
        notes = note_service.list_by_user(db, user2.id)
        assert len(notes) == 0

    def test_ordered_by_created_at_desc(self, db):
        user = make_user(db, "ord@test.br")
        note_service.create(db, user_id=user.id, text="Primeira", file_url=None, file_name=None, created_by_id=user.id)
        note_service.create(db, user_id=user.id, text="Segunda", file_url=None, file_name=None, created_by_id=user.id)
        notes = note_service.list_by_user(db, user.id)
        assert notes[0].text == "Segunda"


class TestGetById:
    def test_returns_note(self, db):
        user = make_user(db, "getid@test.br")
        note = note_service.create(db, user_id=user.id, text="Get", file_url=None, file_name=None, created_by_id=user.id)
        found = note_service.get_by_id(db, note.id)
        assert found is not None
        assert found.id == note.id

    def test_returns_none_for_unknown(self, db):
        assert note_service.get_by_id(db, 9999) is None


class TestDelete:
    def test_deletes_note(self, db):
        user = make_user(db, "del@test.br")
        note = note_service.create(db, user_id=user.id, text="Del", file_url=None, file_name=None, created_by_id=user.id)
        note_id = note.id
        note_service.delete(db, note)
        assert note_service.get_by_id(db, note_id) is None
