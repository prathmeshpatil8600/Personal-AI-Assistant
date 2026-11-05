CREATE TABLE conversation_context_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  conversation_id UUID NOT NULL,
  message_id UUID,
  label TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX conversation_context_pins_lookup_idx ON conversation_context_pins(user_id,conversation_id,created_at DESC);

ALTER TABLE ai_optimization_daily ADD COLUMN IF NOT EXISTS summary_updates INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_optimization_daily ADD COLUMN IF NOT EXISTS estimated_input_tokens_saved BIGINT NOT NULL DEFAULT 0;
ALTER TABLE ai_optimization_daily ADD COLUMN IF NOT EXISTS context_budget_hits INTEGER NOT NULL DEFAULT 0;