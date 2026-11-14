CREATE TABLE pilot_measurement_daily (
  snapshot_date DATE PRIMARY KEY,
  cohort TEXT NOT NULL DEFAULT 'PILOT_1',
  active_users INTEGER NOT NULL DEFAULT 0,
  requests_7d INTEGER NOT NULL DEFAULT 0,
  units_7d BIGINT NOT NULL DEFAULT 0,
  ai_cost_microusd_7d BIGINT NOT NULL DEFAULT 0,
  d1_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
  d3_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
  d7_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
  first_chat_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
  onboarding_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
  avg_requests_per_active_user NUMERIC(12,3) NOT NULL DEFAULT 0,
  recommendation TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);