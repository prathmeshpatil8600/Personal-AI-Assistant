CREATE TABLE pilot_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('BUG','USABILITY','FEATURE','PERFORMANCE','OTHER')),
  severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 5 AND 4000),
  page TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','TRIAGED','RESOLVED','WONT_FIX')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX pilot_feedback_user_idx ON pilot_feedback(user_id,created_at DESC);
CREATE INDEX pilot_feedback_open_idx ON pilot_feedback(status,severity,created_at DESC);