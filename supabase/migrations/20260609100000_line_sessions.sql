CREATE TABLE IF NOT EXISTS line_sessions (
  line_user_id TEXT PRIMARY KEY,
  state        JSONB        NOT NULL DEFAULT '{}',
  expires_at   TIMESTAMPTZ  NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS line_sessions_expires_at_idx ON line_sessions (expires_at);
