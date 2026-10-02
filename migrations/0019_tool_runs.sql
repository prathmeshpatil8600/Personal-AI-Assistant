CREATE TABLE tool_runs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL,
 conversation_id UUID,
 tool_name TEXT NOT NULL,
 provider TEXT NOT NULL DEFAULT 'internal',
 risk_level TEXT NOT NULL CHECK (risk_level IN ('READ','WRITE','SENSITIVE','DESTRUCTIVE')),
 input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
 result_json JSONB,
 status TEXT NOT NULL CHECK (status IN ('RUNNING','COMPLETED','FAILED','BLOCKED')),
 approval_required BOOLEAN NOT NULL DEFAULT false,
 approval_id UUID,
 error_message TEXT,
 latency_ms INTEGER,
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 completed_at TIMESTAMPTZ
)