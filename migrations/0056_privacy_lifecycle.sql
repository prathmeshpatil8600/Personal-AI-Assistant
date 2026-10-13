CREATE TABLE IF NOT EXISTS privacy_erasure_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_hash TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'APPLICATION_DATA_ERASED',
  retained_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS privacy_erasure_log_created_idx
  ON privacy_erasure_log(created_at DESC);