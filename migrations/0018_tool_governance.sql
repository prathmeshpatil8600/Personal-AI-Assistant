CREATE TABLE tool_approvals (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL,
 conversation_id UUID,
 tool_name TEXT NOT NULL,
 risk_level TEXT NOT NULL CHECK (risk_level IN ('SENSITIVE','DESTRUCTIVE')),
 input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','CONSUMED','EXPIRED')),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT (now()+interval '15 minutes'),
 decided_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)