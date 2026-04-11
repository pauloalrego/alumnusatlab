CREATE TABLE IF NOT EXISTS activity_events (
    id             SERIAL PRIMARY KEY,
    actor_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action         VARCHAR(50) NOT NULL,
    entity_type    VARCHAR(50),
    entity_id      INTEGER,
    metadata_json  JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_target_user ON activity_events(target_user_id, created_at DESC);
CREATE INDEX idx_activity_actor       ON activity_events(actor_id, created_at DESC);
