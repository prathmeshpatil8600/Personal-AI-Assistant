CREATE TABLE usage_rate_cards (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 provider TEXT NOT NULL,
 meter_key TEXT NOT NULL,
 model TEXT,
 input_microusd_per_million BIGINT NOT NULL DEFAULT 0 CHECK (input_microusd_per_million >= 0),
 output_microusd_per_million BIGINT NOT NULL DEFAULT 0 CHECK (output_microusd_per_million >= 0),
 fixed_microusd_per_event BIGINT NOT NULL DEFAULT 0 CHECK (fixed_microusd_per_event >= 0),
 microusd_per_mb BIGINT NOT NULL DEFAULT 0 CHECK (microusd_per_mb >= 0),
 microusd_per_item BIGINT NOT NULL DEFAULT 0 CHECK (microusd_per_item >= 0),
 active BOOLEAN NOT NULL DEFAULT true,
 effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
 effective_to TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX usage_rate_cards_lookup_idx
 ON usage_rate_cards(provider,meter_key,model,effective_from DESC)
 WHERE active=true;

CREATE TABLE usage_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL,
 event_key TEXT NOT NULL UNIQUE,
 event_type TEXT NOT NULL,
 source TEXT NOT NULL DEFAULT 'app',
 provider TEXT,
 model TEXT,
 purpose TEXT,
 ai_run_id UUID REFERENCES ai_runs(id) ON DELETE SET NULL,
 tool_run_id UUID REFERENCES tool_runs(id) ON DELETE SET NULL,
 document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
 input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
 output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
 bytes_processed BIGINT CHECK (bytes_processed IS NULL OR bytes_processed >= 0),
 item_count INTEGER CHECK (item_count IS NULL OR item_count >= 0),
 estimated_cost_microusd BIGINT CHECK (estimated_cost_microusd IS NULL OR estimated_cost_microusd >= 0),
 priced BOOLEAN NOT NULL DEFAULT false,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX usage_events_user_time_idx ON usage_events(user_id,occurred_at DESC);
CREATE INDEX usage_events_type_time_idx ON usage_events(event_type,occurred_at DESC);
CREATE INDEX usage_events_ai_run_idx ON usage_events(ai_run_id) WHERE ai_run_id IS NOT NULL;
CREATE INDEX usage_events_tool_run_idx ON usage_events(tool_run_id) WHERE tool_run_id IS NOT NULL;