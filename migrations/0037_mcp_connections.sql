CREATE TABLE mcp_connections (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL,
 provider TEXT NOT NULL,
 server_name TEXT NOT NULL,
 server_url TEXT,
 auth_type TEXT NOT NULL DEFAULT 'OAUTH',
 status TEXT NOT NULL DEFAULT 'DISCONNECTED',
 enabled BOOLEAN NOT NULL DEFAULT true,
 scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 last_checked_at TIMESTAMPTZ,
 last_success_at TIMESTAMPTZ,
 last_error TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(user_id,provider,server_name)
)