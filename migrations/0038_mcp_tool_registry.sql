CREATE TABLE mcp_tool_registry (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL,
 connection_id UUID REFERENCES mcp_connections(id) ON DELETE CASCADE,
 tool_name TEXT NOT NULL,
 provider TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 risk_level TEXT NOT NULL DEFAULT 'SENSITIVE',
 enabled BOOLEAN NOT NULL DEFAULT true,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(user_id,provider,tool_name)
)