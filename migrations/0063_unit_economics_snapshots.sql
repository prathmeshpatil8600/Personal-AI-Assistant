CREATE TABLE unit_economics_daily_snapshots (
  snapshot_date DATE PRIMARY KEY,
  status TEXT NOT NULL,
  active_pilot_users INTEGER NOT NULL DEFAULT 0,
  projected_monthly_ai_cost_usd_per_active_user NUMERIC(18,8) NOT NULL DEFAULT 0,
  plus_break_even_conversion_percent NUMERIC(10,4),
  blended_break_even_conversion_percent NUMERIC(10,4),
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX unit_economics_daily_snapshots_date_idx ON unit_economics_daily_snapshots(snapshot_date DESC);