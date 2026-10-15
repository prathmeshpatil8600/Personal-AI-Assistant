CREATE TABLE pilot_review_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_date DATE NOT NULL,
  cohort TEXT NOT NULL DEFAULT 'PILOT_1',
  checkpoint TEXT NOT NULL DEFAULT 'DAILY',
  recommendation TEXT NOT NULL CHECK (recommendation IN ('HOLD','CONTINUE','EXPAND','PAUSE')),
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(review_date,cohort,checkpoint)
);
CREATE INDEX pilot_review_snapshots_date_idx ON pilot_review_snapshots(review_date DESC,cohort);