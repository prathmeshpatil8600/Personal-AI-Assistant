DELETE FROM user_plan_assignments WHERE user_id='b2-synthetic-test-user';

CREATE TABLE business_daily_snapshots (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 snapshot_date DATE NOT NULL UNIQUE,
 metrics JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX business_daily_snapshots_date_idx ON business_daily_snapshots(snapshot_date DESC);