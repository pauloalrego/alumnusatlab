-- Migration 015: extrai campos de plano de users para user_plans.

CREATE TABLE IF NOT EXISTS user_plans (
    id                   SERIAL PRIMARY KEY,
    user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_type            VARCHAR(20),
    plan_status          VARCHAR(20),
    account_activated_at TIMESTAMPTZ,
    plan_period_ends_at  TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

-- Migra dados existentes
INSERT INTO user_plans (user_id, plan_type, plan_status, account_activated_at, plan_period_ends_at)
SELECT id, plan_type, plan_status, account_activated_at, plan_period_ends_at
FROM users
WHERE plan_type IS NOT NULL OR plan_status IS NOT NULL
   OR account_activated_at IS NOT NULL OR plan_period_ends_at IS NOT NULL;

ALTER TABLE users DROP COLUMN IF EXISTS plan_type;
ALTER TABLE users DROP COLUMN IF EXISTS plan_status;
ALTER TABLE users DROP COLUMN IF EXISTS account_activated_at;
ALTER TABLE users DROP COLUMN IF EXISTS plan_period_ends_at;
