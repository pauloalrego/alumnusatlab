-- =============================================================================
-- Alumnus — DDL completo
-- PostgreSQL 16+
-- =============================================================================

-- ── Institucional ─────────────────────────────────────────────────────────────

CREATE TABLE institutions (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    domain     VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE professors (
    id         SERIAL PRIMARY KEY,
    nome       VARCHAR(255) NOT NULL,
    ativo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE professor_institutions (
    id                  SERIAL PRIMARY KEY,
    professor_id        INTEGER NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
    institution_id      INTEGER NOT NULL REFERENCES institutions(id),
    institutional_email VARCHAR(255) UNIQUE NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (professor_id, institution_id)
);

CREATE TABLE research_groups (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    institution_id INTEGER REFERENCES institutions(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE professor_groups (
    professor_id   INTEGER NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
    group_id       INTEGER NOT NULL REFERENCES research_groups(id) ON DELETE CASCADE,
    role_in_group  VARCHAR(20) NOT NULL DEFAULT 'coordinator',
    institution_id INTEGER REFERENCES institutions(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (professor_id, group_id)
);

-- ── Pesquisadores ─────────────────────────────────────────────────────────────

CREATE TABLE researchers (
    id              SERIAL PRIMARY KEY,
    nome            VARCHAR(255) NOT NULL,
    status          VARCHAR(50)  NOT NULL,   -- graduacao | mestrado | doutorado | postdoc
    email           VARCHAR(255),
    group_id        INTEGER REFERENCES research_groups(id) ON DELETE SET NULL,
    orientador_id   INTEGER REFERENCES professors(id)      ON DELETE SET NULL,
    observacoes     TEXT,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    registered      BOOLEAN NOT NULL DEFAULT FALSE,
    matricula       VARCHAR(50),
    curso           VARCHAR(255),
    enrollment_date DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE relationships (
    id                   SERIAL PRIMARY KEY,
    source_researcher_id INTEGER NOT NULL REFERENCES researchers(id) ON DELETE CASCADE,
    target_researcher_id INTEGER NOT NULL REFERENCES researchers(id) ON DELETE CASCADE,
    relation_type        VARCHAR(50) NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Usuários ──────────────────────────────────────────────────────────────────

CREATE TABLE users (
    id                   SERIAL PRIMARY KEY,
    email                VARCHAR(255) UNIQUE NOT NULL,
    nome                 VARCHAR(255) NOT NULL,
    password_hash        VARCHAR(255) NOT NULL,
    role                 VARCHAR(20)  NOT NULL,   -- superadmin | professor | student
    is_admin             BOOLEAN NOT NULL DEFAULT FALSE,
    professor_id         INTEGER REFERENCES professors(id)   ON DELETE SET NULL,
    researcher_id        INTEGER REFERENCES researchers(id)  ON DELETE SET NULL,
    last_login           TIMESTAMPTZ,
    plan_type            VARCHAR(20),
    plan_status          VARCHAR(20),
    account_activated_at TIMESTAMPTZ,
    plan_period_ends_at  TIMESTAMPTZ,
    -- perfil público
    photo_url            VARCHAR(500),
    photo_thumb_url      VARCHAR(500),
    lattes_url           VARCHAR(500),
    scholar_url          VARCHAR(500),
    linkedin_url         VARCHAR(500),
    github_url           VARCHAR(500),
    instagram_url        VARCHAR(50),
    twitter_url          VARCHAR(50),
    whatsapp             VARCHAR(20),
    interesses           TEXT,
    bio                  TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Conteúdo colaborativo ─────────────────────────────────────────────────────

CREATE TABLE notes (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text           TEXT NOT NULL,
    file_url       VARCHAR(500),
    file_name      VARCHAR(255),
    created_by_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reminders (
    id             SERIAL PRIMARY KEY,
    text           TEXT NOT NULL,
    due_date       DATE,
    done           BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    institution_id INTEGER REFERENCES institutions(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tips (
    id             SERIAL PRIMARY KEY,
    question       TEXT NOT NULL,
    answer         TEXT NOT NULL,
    author_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    institution_id INTEGER REFERENCES institutions(id) ON DELETE SET NULL,
    position       INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tip_votes (
    entry_id INTEGER NOT NULL REFERENCES tips(id) ON DELETE CASCADE,
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, user_id)
);

CREATE TABLE tip_comments (
    id         SERIAL PRIMARY KEY,
    entry_id   INTEGER NOT NULL REFERENCES tips(id) ON DELETE CASCADE,
    text       TEXT NOT NULL,
    author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE deadlines (
    id             SERIAL PRIMARY KEY,
    label          VARCHAR(255) NOT NULL,
    url            TEXT         NOT NULL,
    date           DATE         NOT NULL,
    institution_id INTEGER REFERENCES institutions(id) ON DELETE CASCADE,
    created_by_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE deadline_interests (
    id          SERIAL PRIMARY KEY,
    deadline_id INTEGER NOT NULL REFERENCES deadlines(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT deadline_interests_key UNIQUE (deadline_id, user_id)
);

-- ── Infraestrutura ────────────────────────────────────────────────────────────

CREATE TABLE file_uploads (
    id            SERIAL PRIMARY KEY,
    data          BYTEA        NOT NULL,
    mime_type     VARCHAR(100) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE graph_layouts (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(100) DEFAULT 'default',
    layout_jsonb JSONB        DEFAULT '{}',
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE schema_migrations (
    id      SERIAL PRIMARY KEY,
    name    TEXT UNIQUE NOT NULL,
    applied TIMESTAMPTZ NOT NULL DEFAULT now()
);
