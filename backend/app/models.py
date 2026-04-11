from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, JSON, Text, LargeBinary, UniqueConstraint
from sqlalchemy.orm import relationship

from .database import Base


# ── Instituição ───────────────────────────────────────────────────────────────

class Institution(Base):
    __tablename__ = "institutions"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(255), nullable=False)
    domain     = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, server_default="now()")
    updated_at = Column(DateTime, default=datetime.utcnow, server_default="now()", onupdate=datetime.utcnow)

    professor_institutions = relationship("ProfessorInstitution", back_populates="institution")
    groups                 = relationship("ResearchGroup", back_populates="institution")


# ── Professor ─────────────────────────────────────────────────────────────────

class Professor(Base):
    __tablename__ = "professors"

    id         = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, server_default="now()")
    updated_at = Column(DateTime, default=datetime.utcnow, server_default="now()", onupdate=datetime.utcnow)

    user                   = relationship("User", back_populates="professor", uselist=False)
    professor_institutions = relationship("ProfessorInstitution", back_populates="professor", cascade="all, delete-orphan")
    professor_groups       = relationship("ProfessorGroup", back_populates="professor", cascade="all, delete-orphan")
    researchers            = relationship("Researcher", back_populates="orientador")

    @property
    def nome(self) -> str:
        return self.user.nome if self.user else ""

    @nome.setter
    def nome(self, value: str) -> None:
        if self.user:
            self.user.nome = value

    @property
    def ativo(self) -> bool:
        return self.user.ativo if self.user else False

    @ativo.setter
    def ativo(self, value: bool) -> None:
        if self.user:
            self.user.ativo = value


class ProfessorInstitution(Base):
    __tablename__ = "professor_institutions"

    id                  = Column(Integer, primary_key=True, index=True)
    professor_id        = Column(Integer, ForeignKey("professors.id", ondelete="CASCADE"), nullable=False)
    institution_id      = Column(Integer, ForeignKey("institutions.id"), nullable=False)
    institutional_email = Column(String(255), unique=True, nullable=False)
    created_at          = Column(DateTime, default=datetime.utcnow, server_default="now()")

    professor   = relationship("Professor", back_populates="professor_institutions")
    institution = relationship("Institution", back_populates="professor_institutions")

    __table_args__ = (UniqueConstraint("professor_id", "institution_id"),)


# ── Grupo de pesquisa ─────────────────────────────────────────────────────────

class ResearchGroup(Base):
    __tablename__ = "research_groups"

    id             = Column(Integer, primary_key=True, index=True)
    name           = Column(String(255), nullable=False)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow, server_default="now()")
    updated_at     = Column(DateTime, default=datetime.utcnow, server_default="now()", onupdate=datetime.utcnow)

    institution      = relationship("Institution", back_populates="groups")
    professor_groups = relationship("ProfessorGroup", back_populates="group", cascade="all, delete-orphan")
    researchers      = relationship("Researcher", back_populates="group")


class ProfessorGroup(Base):
    __tablename__ = "professor_groups"

    professor_id   = Column(Integer, ForeignKey("professors.id", ondelete="CASCADE"), primary_key=True)
    group_id       = Column(Integer, ForeignKey("research_groups.id", ondelete="CASCADE"), primary_key=True)
    role_in_group  = Column(String(20), nullable=False, default="coordinator")
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow, server_default="now()")

    professor   = relationship("Professor", back_populates="professor_groups")
    group       = relationship("ResearchGroup", back_populates="professor_groups")
    institution = relationship("Institution")


# ── Pesquisador ───────────────────────────────────────────────────────────────

class Researcher(Base):
    __tablename__ = "researchers"

    id               = Column(Integer, primary_key=True, index=True)
    status           = Column(String(50), nullable=False)
    group_id         = Column(Integer, ForeignKey("research_groups.id"), nullable=True)
    orientador_id    = Column(Integer, ForeignKey("professors.id"), nullable=True)
    matricula        = Column(String(50), nullable=True)
    curso            = Column(String(255), nullable=True)
    enrollment_date  = Column(Date, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow, server_default="now()")
    updated_at       = Column(DateTime, default=datetime.utcnow, server_default="now()", onupdate=datetime.utcnow)

    orientador = relationship("Professor", back_populates="researchers")
    group      = relationship("ResearchGroup", back_populates="researchers")
    user       = relationship("User", primaryjoin="User.researcher_id == Researcher.id", foreign_keys="[User.researcher_id]", uselist=False, viewonly=True)

    @property
    def ativo(self) -> bool:
        return self.user.ativo if self.user else False

    @ativo.setter
    def ativo(self, value: bool) -> None:
        if self.user:
            self.user.ativo = value

    @property
    def nome(self) -> str:
        return self.user.nome if self.user else ""

    @property
    def email(self) -> str | None:
        return self.user.email if self.user else None

    @property
    def registered(self) -> bool:
        return bool(self.user and self.user.password_hash)

    @property
    def photo_url(self) -> str | None:
        return self.user.photo_url if self.user else None

    @property
    def photo_thumb_url(self) -> str | None:
        return self.user.photo_thumb_url if self.user else None

    @property
    def orientador_nome(self) -> str | None:
        return self.orientador.nome if self.orientador else None


# ── Leituras ──────────────────────────────────────────────────────────────────

class Reading(Base):
    __tablename__ = "readings"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    url           = Column(Text, nullable=False)
    title         = Column(String(500), nullable=True)
    status        = Column(String(20), nullable=False, default="quero_ler")
    summary       = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user           = relationship("User", foreign_keys=[user_id])
    created_by     = relationship("User", foreign_keys=[created_by_id])
    status_history = relationship("ReadingStatusHistory", back_populates="reading",
                                  cascade="all, delete-orphan", order_by="ReadingStatusHistory.changed_at")


class ReadingStatusHistory(Base):
    __tablename__ = "reading_status_history"

    id            = Column(Integer, primary_key=True, index=True)
    reading_id    = Column(Integer, ForeignKey("readings.id"), nullable=False)
    status        = Column(String(20), nullable=False)
    changed_at    = Column(DateTime, default=datetime.utcnow)
    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    reading    = relationship("Reading", back_populates="status_history")
    changed_by = relationship("User", foreign_keys=[changed_by_id])


# ── Marcos temporais ──────────────────────────────────────────────────────────

class Milestone(Base):
    __tablename__ = "milestones"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type          = Column(String(50), nullable=False)
    title         = Column(String(500), nullable=False)
    date          = Column(Date, nullable=False)
    description   = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user       = relationship("User", foreign_keys=[user_id])
    created_by = relationship("User", foreign_keys=[created_by_id])


# ── Relacionamentos ───────────────────────────────────────────────────────────

class Relationship(Base):
    __tablename__ = "relationships"

    id                   = Column(Integer, primary_key=True, index=True)
    source_researcher_id = Column(Integer, ForeignKey("researchers.id"), nullable=False)
    target_researcher_id = Column(Integer, ForeignKey("researchers.id"), nullable=False)
    relation_type        = Column(String(50), nullable=False)
    created_at           = Column(DateTime, default=datetime.utcnow, server_default="now()")

    source_researcher = relationship("Researcher", foreign_keys=[source_researcher_id])
    target_researcher = relationship("Researcher", foreign_keys=[target_researcher_id])


# ── Notas ─────────────────────────────────────────────────────────────────────

class Note(Base):
    __tablename__ = "notes"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=True)
    text           = Column(Text, nullable=False)
    file_url       = Column(String(500), nullable=True)
    file_name      = Column(String(255), nullable=True)
    created_by_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow, server_default="now()")
    updated_at     = Column(DateTime, default=datetime.utcnow, server_default="now()", onupdate=datetime.utcnow)

    created_by = relationship("User", foreign_keys=[created_by_id])


# ── Plano de usuário ──────────────────────────────────────────────────────────

class UserPlan(Base):
    __tablename__ = "user_plans"

    id                   = Column(Integer, primary_key=True, index=True)
    user_id              = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    plan_type            = Column(String(20), nullable=True)
    plan_status          = Column(String(20), nullable=True)
    account_activated_at = Column(DateTime, nullable=True)
    plan_period_ends_at  = Column(DateTime, nullable=True)
    created_at           = Column(DateTime, default=datetime.utcnow, server_default="now()")
    updated_at           = Column(DateTime, default=datetime.utcnow, server_default="now()", onupdate=datetime.utcnow)

    user = relationship("User", back_populates="plan")


# ── Usuário ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id                  = Column(Integer, primary_key=True, index=True)
    email               = Column(String(255), unique=True, nullable=False, index=True)
    nome                = Column(String(255), nullable=False)
    password_hash       = Column(String(255), nullable=True)
    role                = Column(String(20), nullable=False)
    ativo               = Column(Boolean, nullable=False, default=True)
    professor_id        = Column(Integer, ForeignKey("professors.id"), nullable=True)
    researcher_id       = Column(Integer, ForeignKey("researchers.id"), nullable=True)
    last_login          = Column(DateTime, nullable=True)
    photo_file_id       = Column(Integer, ForeignKey("file_uploads.id"), nullable=True)
    photo_thumb_file_id = Column(Integer, ForeignKey("file_uploads.id"), nullable=True)
    lattes_url          = Column(String(500), nullable=True)
    scholar_url         = Column(String(500), nullable=True)
    linkedin_url        = Column(String(500), nullable=True)
    github_url          = Column(String(500), nullable=True)
    instagram_url       = Column(String(50), nullable=True)
    twitter_url         = Column(String(50), nullable=True)
    whatsapp            = Column(String(20), nullable=True)
    interesses          = Column(Text, nullable=True)
    bio                 = Column(Text, nullable=True)
    birth_date          = Column(Date, nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow, server_default="now()")
    updated_at          = Column(DateTime, default=datetime.utcnow, server_default="now()", onupdate=datetime.utcnow)

    professor  = relationship("Professor", back_populates="user", foreign_keys=[professor_id])
    researcher = relationship("Researcher", foreign_keys=[researcher_id])
    plan       = relationship("UserPlan", back_populates="user", uselist=False)

    @property
    def is_admin(self) -> bool:
        return self.role == "superadmin"

    @property
    def photo_url(self) -> str | None:
        return f"/api/files/{self.photo_file_id}" if self.photo_file_id else None

    @property
    def photo_thumb_url(self) -> str | None:
        return f"/api/files/{self.photo_thumb_file_id}" if self.photo_thumb_file_id else None


# ── Eventos de atividade ─────────────────────────────────────────────────────

class ActivityEvent(Base):
    __tablename__ = "activity_events"

    id             = Column(Integer, primary_key=True, index=True)
    actor_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action         = Column(String(50), nullable=False)
    entity_type    = Column(String(50), nullable=True)
    entity_id      = Column(Integer, nullable=True)
    metadata_json  = Column(JSON, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow, server_default="now()")

    actor       = relationship("User", foreign_keys=[actor_id])
    target_user = relationship("User", foreign_keys=[target_user_id])


# ── Upload de arquivos ────────────────────────────────────────────────────────

class FileUpload(Base):
    __tablename__ = "file_uploads"

    id            = Column(Integer, primary_key=True, index=True)
    data          = Column(LargeBinary, nullable=False)
    mime_type     = Column(String(100), nullable=False)
    original_name = Column(String(255), nullable=False)
    created_at    = Column(DateTime, default=datetime.utcnow, server_default="now()")


# ── Layout do grafo ───────────────────────────────────────────────────────────

class GraphLayout(Base):
    __tablename__ = "graph_layouts"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String(100), default="default")
    layout_jsonb = Column(JSON, default=dict)
    updated_at   = Column(DateTime, default=datetime.utcnow, server_default="now()", onupdate=datetime.utcnow)


# ── Lembretes ─────────────────────────────────────────────────────────────────

class Reminder(Base):
    __tablename__ = "reminders"

    id             = Column(Integer, primary_key=True, index=True)
    text           = Column(Text, nullable=False)
    due_date       = Column(Date, nullable=True)
    done           = Column(Boolean, default=False, nullable=False)
    created_by_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow, server_default="now()")
    updated_at     = Column(DateTime, default=datetime.utcnow, server_default="now()", onupdate=datetime.utcnow)

    created_by  = relationship("User", foreign_keys=[created_by_id])
    institution = relationship("Institution", foreign_keys=[institution_id])


# ── Manual (dicas) ────────────────────────────────────────────────────────────

class Tip(Base):
    __tablename__ = "tips"

    id             = Column(Integer, primary_key=True, index=True)
    question       = Column(Text, nullable=False)
    answer         = Column(Text, nullable=False)
    author_id      = Column(Integer, ForeignKey("users.id"), nullable=True)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=True)
    position       = Column(Integer, default=0, nullable=False)
    created_at     = Column(DateTime, default=datetime.utcnow, server_default="now()")
    updated_at     = Column(DateTime, default=datetime.utcnow, server_default="now()", onupdate=datetime.utcnow)

    author      = relationship("User", foreign_keys=[author_id])
    institution = relationship("Institution", foreign_keys=[institution_id])
    votes       = relationship("TipVote", back_populates="entry", cascade="all, delete-orphan")
    comments    = relationship("TipComment", back_populates="entry", cascade="all, delete-orphan", order_by="TipComment.created_at")


class TipVote(Base):
    __tablename__ = "tip_votes"

    entry_id = Column(Integer, ForeignKey("tips.id", ondelete="CASCADE"), primary_key=True)
    user_id  = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)

    entry = relationship("Tip", back_populates="votes")
    user  = relationship("User", foreign_keys=[user_id])


class TipComment(Base):
    __tablename__ = "tip_comments"

    id         = Column(Integer, primary_key=True, index=True)
    entry_id   = Column(Integer, ForeignKey("tips.id", ondelete="CASCADE"), nullable=False)
    text       = Column(Text, nullable=False)
    author_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, server_default="now()")
    updated_at = Column(DateTime, default=datetime.utcnow, server_default="now()", onupdate=datetime.utcnow)

    entry  = relationship("Tip", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id])


# ── Prazos ────────────────────────────────────────────────────────────────────

class Deadline(Base):
    __tablename__ = "deadlines"

    id             = Column(Integer, primary_key=True, index=True)
    label          = Column(String(255), nullable=False)
    url            = Column(Text, nullable=False)
    date           = Column(Date, nullable=False)
    abstract_date  = Column(Date, nullable=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=True)
    created_by_id  = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow, server_default="now()")
    updated_at     = Column(DateTime, default=datetime.utcnow, server_default="now()", onupdate=datetime.utcnow)

    institution = relationship("Institution", foreign_keys=[institution_id])
    created_by  = relationship("User", foreign_keys=[created_by_id])
    interests   = relationship("DeadlineInterest", back_populates="deadline", cascade="all, delete-orphan")


class DeadlineInterest(Base):
    __tablename__ = "deadline_interests"

    id          = Column(Integer, primary_key=True, index=True)
    deadline_id = Column(Integer, ForeignKey("deadlines.id", ondelete="CASCADE"), nullable=False)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow, server_default="now()")

    deadline = relationship("Deadline", back_populates="interests")
    user     = relationship("User", foreign_keys=[user_id])

    __table_args__ = (UniqueConstraint("deadline_id", "user_id", name="deadline_interests_key"),)
