CREATE TABLE pilot_participants (
  user_id TEXT PRIMARY KEY,
  cohort TEXT NOT NULL DEFAULT 'PILOT_1',
  status TEXT NOT NULL DEFAULT 'INVITED' CHECK (status IN ('INVITED','ACTIVE','PAUSED','REMOVED')),
  invited_by TEXT,
  activated_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_onboarding (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'STARTED' CHECK (status IN ('STARTED','COMPLETED','SKIPPED')),
  completed_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  first_chat_at TIMESTAMPTZ,
  first_task_at TIMESTAMPTZ,
  first_memory_at TIMESTAMPTZ,
  first_document_at TIMESTAMPTZ,
  first_integration_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pilot_participants_status_idx ON pilot_participants(status,cohort);