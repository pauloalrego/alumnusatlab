-- Adiciona colunas de plano em users (caso ainda não existam)
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_type            VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_status          VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_activated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_period_ends_at  TIMESTAMPTZ;
