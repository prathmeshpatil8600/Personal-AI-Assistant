CREATE TABLE ai_benchmark_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id UUID NOT NULL,
  scenario_key TEXT NOT NULL,
  scenario_name TEXT NOT NULL,
  expected_lane TEXT,
  actual_lane TEXT,
  provider TEXT,
  model TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  quality_pass BOOLEAN NOT NULL DEFAULT false,
  latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_trimmed_messages INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_benchmark_runs_suite_idx ON ai_benchmark_runs(suite_id,created_at);
CREATE INDEX ai_benchmark_runs_created_idx ON ai_benchmark_runs(created_at DESC);