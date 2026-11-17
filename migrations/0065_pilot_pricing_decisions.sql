CREATE TABLE pilot_pricing_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_date DATE NOT NULL DEFAULT CURRENT_DATE,
  cohort TEXT NOT NULL DEFAULT 'PILOT_1',
  cohort_decision TEXT NOT NULL,
  free_recommendation TEXT NOT NULL,
  plus_recommendation TEXT NOT NULL,
  pro_recommendation TEXT NOT NULL,
  confidence TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pilot_pricing_decisions_date_idx ON pilot_pricing_decisions(decision_date DESC,created_at DESC);