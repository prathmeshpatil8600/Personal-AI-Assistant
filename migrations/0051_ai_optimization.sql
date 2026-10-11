CREATE TABLE ai_response_cache (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL,
 cache_key TEXT NOT NULL,
 purpose TEXT NOT NULL,
 model TEXT NOT NULL,
 response_json JSONB NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 last_hit_at TIMESTAMPTZ,
 hit_count INTEGER NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
 UNIQUE(user_id,cache_key)
);

CREATE TABLE ai_optimization_daily (
 user_id TEXT NOT NULL,
 metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
 deterministic_responses INTEGER NOT NULL DEFAULT 0 CHECK (deterministic_responses >= 0),
 cache_hits INTEGER NOT NULL DEFAULT 0 CHECK (cache_hits >= 0),
 cheap_model_runs INTEGER NOT NULL DEFAULT 0 CHECK (cheap_model_runs >= 0),
 standard_model_runs INTEGER NOT NULL DEFAULT 0 CHECK (standard_model_runs >= 0),
 messages_trimmed INTEGER NOT NULL DEFAULT 0 CHECK (messages_trimmed >= 0),
 memories_injected INTEGER NOT NULL DEFAULT 0 CHECK (memories_injected >= 0),
 tools_injected INTEGER NOT NULL DEFAULT 0 CHECK (tools_injected >= 0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,metric_date)
);

CREATE INDEX ai_response_cache_expiry_idx ON ai_response_cache(expires_at);
CREATE INDEX ai_optimization_daily_date_idx ON ai_optimization_daily(metric_date DESC);