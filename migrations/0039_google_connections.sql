CREATE TABLE google_connections (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL UNIQUE,
 account_email TEXT,
 encrypted_refresh_token TEXT NOT NULL,
 token_iv TEXT NOT NULL,
 scopes TEXT[] NOT NULL DEFAULT '{}',
 status TEXT NOT NULL DEFAULT 'CONNECTED',
 connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 last_used_at TIMESTAMPTZ,
 last_error TEXT
)