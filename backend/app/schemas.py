import datetime as _dt
import re
from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, field_validator

_INSTAGRAM_HANDLE = re.compile(r"^[A-Za-z0-9._]{1,30}$")
_TWITTER_HANDLE = re.compile(r"^[A-Za-z0-9_]{1,15}$")
_LATTES_URL = re.compile(r"^https?://lattes\.cnpq\.br/\d{16}$")


# --- Institution ---

class InstitutionOut(BaseModel):
    id: int
    name: str
    domain: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Professor ---

class ProfessorOut(BaseModel):
    id: int
    nome: str
    ativo: bool
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ProfessorUpdate(BaseModel):
    nome: Optional[str] = None


class ProfessorInstitutionOut(BaseModel):
    id: int
    professor_id: int
    institution_id: int
    institutional_email: str
    institution_name: Optional[str] = None
    institution_domain: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AddInstitutionalEmail(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def email_normalize(cls, v: str) -> str:
        return (v or "").strip().lower()


# --- Research Group ---

class ResearchGroupOut(BaseModel):
    id: int
    name: str
    institution_id: Optional[int] = None
    institution_name: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ResearchGroupCreate(BaseModel):
    name: str
    institution_id: int


class ResearchGroupUpdate(BaseModel):
    name: Optional[str] = None
    institution_id: Optional[int] = None


class JoinGroupRequest(BaseModel):
    institution_id: int


# --- Researcher ---

class ResearcherCreate(BaseModel):
    nome: str
    email: str  # obrigatório: cria User vinculado
    status: str
    orientador_id: Optional[int] = None  # FK → professors.id
    group_id: Optional[int] = None
    institution_id: Optional[int] = None

    @field_validator("email")
    @classmethod
    def email_normalize(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if not v:
            raise ValueError("Email é obrigatório")
        return v

    @field_validator("nome")
    @classmethod
    def nome_strip(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Nome é obrigatório")
        return v


class ResearcherUpdate(BaseModel):
    # nome e email são gerenciados via User — use PATCH /users/me ou admin
    status: Optional[str] = None
    orientador_id: Optional[int] = None  # FK → professors.id
    group_id: Optional[int] = None
    ativo: Optional[bool] = None
    matricula: Optional[str] = None
    curso: Optional[str] = None
    enrollment_date: Optional[date] = None


class ResearcherOut(BaseModel):
    id: int
    nome: str
    status: str
    email: Optional[str]
    group_id: Optional[int] = None
    orientador_id: Optional[int] = None
    orientador_nome: Optional[str] = None
    ativo: bool
    registered: bool
    matricula: Optional[str]
    curso: Optional[str]
    enrollment_date: Optional[date]
    photo_url: Optional[str] = None
    photo_thumb_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Relationship ---

class RelationshipCreate(BaseModel):
    source_researcher_id: int
    target_researcher_id: int
    relation_type: str


class RelationshipUpdate(BaseModel):
    source_researcher_id: Optional[int] = None
    target_researcher_id: Optional[int] = None
    relation_type: Optional[str] = None


class RelationshipOut(BaseModel):
    id: int
    source_researcher_id: int
    target_researcher_id: int
    relation_type: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Note ---

class NoteCreate(BaseModel):
    text: str


class NoteOut(BaseModel):
    id: int
    user_id: int
    text: str
    file_url: Optional[str]
    file_name: Optional[str]
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_creator(cls, note):
        obj = cls.model_validate(note)
        obj.created_by_id = note.created_by_id
        obj.created_by_name = note.created_by.nome if note.created_by else None
        return obj


# --- Auth ---

class RegisterRequest(BaseModel):
    email:    str
    password: str

    @field_validator("email")
    @classmethod
    def email_normalize(cls, v: str) -> str:
        return (v or "").strip().lower()

    @field_validator("password")
    @classmethod
    def password_length(cls, v):
        if len(v) < 8:
            raise ValueError("A senha deve ter ao menos 8 caracteres")
        return v


class LoginRequest(BaseModel):
    email:    str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type:   str = "bearer"


class UserOut(BaseModel):
    id:            int
    email:         str
    nome:          str
    role:          str
    professor_id:  Optional[int] = None
    researcher_id: Optional[int] = None
    last_login:    Optional[datetime]
    created_at:    Optional[datetime] = None
    plan_type:     Optional[str] = None
    plan_status:   Optional[str] = None
    account_activated_at: Optional[datetime] = None
    plan_period_ends_at: Optional[datetime] = None
    trial_days_remaining: Optional[int] = None
    photo_url:       Optional[str] = None
    photo_thumb_url: Optional[str] = None
    lattes_url:      Optional[str] = None
    scholar_url:     Optional[str] = None
    linkedin_url:    Optional[str] = None
    github_url:      Optional[str] = None
    instagram_url:   Optional[str] = None
    twitter_url:     Optional[str] = None
    whatsapp:        Optional[str] = None
    interesses:        Optional[str] = None
    bio:               Optional[str] = None
    birth_date:        Optional[date] = None
    institution_id:    Optional[int] = None
    institution_name:  Optional[str] = None

    model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
    photo_file_id:       Optional[int] = None
    photo_thumb_file_id: Optional[int] = None
    lattes_url:      Optional[str] = None
    scholar_url:     Optional[str] = None
    linkedin_url:    Optional[str] = None
    github_url:      Optional[str] = None
    instagram_url:   Optional[str] = None
    twitter_url:     Optional[str] = None
    whatsapp:        Optional[str] = None
    interesses:      Optional[str] = None
    bio:             Optional[str] = None
    birth_date:      Optional[date] = None
    password:        Optional[str] = None

    @field_validator("lattes_url")
    @classmethod
    def validate_lattes_url(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        s = str(v).strip()
        if not _LATTES_URL.match(s):
            raise ValueError(
                "Lattes: use o formato http://lattes.cnpq.br/1234567890123456 (16 dígitos)"
            )
        return s

    @field_validator("instagram_url")
    @classmethod
    def validate_instagram_handle(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        s = str(v).strip().lstrip("@")
        if not _INSTAGRAM_HANDLE.match(s):
            raise ValueError(
                "Instagram: use o usuário com @ no início (1–30 caracteres: letras, números, . e _)"
            )
        return s

    @field_validator("twitter_url")
    @classmethod
    def validate_twitter_handle(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        s = str(v).strip().lstrip("@")
        if not _TWITTER_HANDLE.match(s):
            raise ValueError(
                "X/Twitter: use o usuário com @ no início (1–15 caracteres: letras, números e _)"
            )
        return s


class ProfileBySlugOut(BaseModel):
    user: Optional[UserOut] = None
    researcher: Optional[ResearcherOut] = None


# --- Reminder ---

class ReminderCreate(BaseModel):
    text: str
    due_date: Optional[date] = None
    institution_id: Optional[int] = None


class ReminderUpdate(BaseModel):
    text: Optional[str] = None
    due_date: Optional[date] = None
    done: Optional[bool] = None


class ReminderOut(BaseModel):
    id: int
    text: str
    due_date: Optional[date]
    done: bool
    created_at: Optional[datetime] = None
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    institution_id: Optional[int] = None

    model_config = {"from_attributes": True}


# --- Graph ---

class LayoutUpdate(BaseModel):
    positions: dict  # {researcher_id: {x, y}}


# --- Tips ---

class TipCreate(BaseModel):
    question: str
    answer: str
    position: Optional[int] = 0
    institution_id: Optional[int] = None


class TipCommentOut(BaseModel):
    id: int
    entry_id: int
    text: str
    author_id: Optional[int]
    author_name: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_author(cls, comment):
        obj = cls.model_validate(comment)
        obj.author_name = comment.author.nome if comment.author else None
        return obj


class TipOut(BaseModel):
    id: int
    question: str
    answer: str
    author_id: Optional[int]
    author_name: Optional[str] = None
    position: int
    vote_count: int = 0
    user_voted: bool = False
    comments: list[TipCommentOut] = []
    created_at: Optional[datetime] = None
    institution_id: Optional[int] = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_context(cls, entry, current_user_id: Optional[int]):
        obj = cls.model_validate(entry)
        obj.author_name = entry.author.nome if entry.author else None
        obj.vote_count = len(entry.votes)
        obj.user_voted = any(v.user_id == current_user_id for v in entry.votes)
        obj.comments = [TipCommentOut.from_orm_with_author(c) for c in entry.comments]
        return obj


class TipUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None


class TipCommentCreate(BaseModel):
    text: str


# --- Deadlines ---

class DeadlineCreate(BaseModel):
    label: str
    url: str
    date: date
    abstract_date: Optional[date] = None
    institution_id: Optional[int] = None


class DeadlineOut(BaseModel):
    id: int
    label: str
    url: str
    date: date
    abstract_date: Optional[date] = None
    institution_id: Optional[int] = None
    created_by_id: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DeadlineInterestOut(BaseModel):
    deadline_id: int
    user_id: int
    user_name: str
    user_photo_url: Optional[str] = None
    user_photo_thumb_url: Optional[str] = None
    profile_slug: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Milestone ---

MILESTONE_TYPES = {"publicacao", "qualificacao", "defesa", "premio", "outro", "entrada"}

class MilestoneCreate(BaseModel):
    type: str
    title: str
    date: date
    description: Optional[str] = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in MILESTONE_TYPES:
            raise ValueError(f"Tipo inválido. Use: {', '.join(sorted(MILESTONE_TYPES))}")
        return v


class MilestoneUpdate(BaseModel):
    type: Optional[str] = None
    title: Optional[str] = None
    date: Optional[_dt.date] = None
    description: Optional[str] = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str | None) -> str | None:
        if v is not None and v not in MILESTONE_TYPES:
            raise ValueError(f"Tipo inválido. Use: {', '.join(sorted(MILESTONE_TYPES))}")
        return v


class MilestoneOut(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    date: date
    description: Optional[str] = None
    created_by_id: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Reading ---

READING_STATUSES = {"quero_ler", "lendo", "lido"}


class ReadingCreate(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def url_strip(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("URL é obrigatória")
        return v


class ReadingStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in READING_STATUSES:
            raise ValueError(f"Status inválido. Use: {', '.join(sorted(READING_STATUSES))}")
        return v


class ReadingStatusHistoryOut(BaseModel):
    id: int
    status: str
    changed_at: Optional[datetime] = None
    changed_by_id: Optional[int] = None
    changed_by_name: Optional[str] = None

    model_config = {"from_attributes": True}


class ReadingOut(BaseModel):
    id: int
    user_id: int
    url: str
    title: Optional[str] = None
    status: str
    summary: Optional[str] = None
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    status_history: list[ReadingStatusHistoryOut] = []

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_history(cls, reading):
        obj = cls.model_validate(reading)
        obj.created_by_name = reading.created_by.nome if reading.created_by else None
        obj.status_history = [
            ReadingStatusHistoryOut(
                id=h.id,
                status=h.status,
                changed_at=h.changed_at,
                changed_by_id=h.changed_by_id,
                changed_by_name=h.changed_by.nome if h.changed_by else None,
            )
            for h in reading.status_history
        ]
        return obj


# --- Activity ---

class ActivityEventOut(BaseModel):
    id: int
    actor_id: int
    actor_name: Optional[str] = None
    target_user_id: int
    target_user_name: Optional[str] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    metadata_json: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_names(cls, event):
        obj = cls.model_validate(event)
        obj.actor_name = event.actor.nome if event.actor else None
        obj.target_user_name = event.target_user.nome if event.target_user else None
        return obj
