CREATE TABLE ai_runs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL,
 purpose TEXT,
 requested_model TEXT,
 provider TEXT,
 model TEXT,
 status TEXT NOT NULL DEFAULT 'STARTED',
 fallback_used BOOLEAN NOT NULL DEFAULT false,
 input_tokens INTEGER,
 output_tokens INTEGER,
 total_tokens INTEGER,
 latency_ms INTEGER,
 error_code TEXT,
 error_message TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 completed_at TIMESTAMPTZ
)