CREATE TABLE github_connections (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL UNIQUE,
 github_user_id TEXT,
 login TEXT,
 encrypted_access_token TEXT NOT NULL,
 access_token_iv TEXT NOT NULL,
 encrypted_refresh_token TEXT,
 refresh_token_iv TEXT,
 access_token_expires_at TIMESTAMPTZ,
 refresh_token_expires_at TIMESTAMPTZ,
 status TEXT NOT NULL DEFAULT 'CONNECTED',
 connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 last_used_at TIMESTAMPTZ,
 last_error TEXT
)