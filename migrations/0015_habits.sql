CREATE TABLE habits (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL,
 name TEXT NOT NULL,
 frequency TEXT NOT NULL DEFAULT 'DAILY' CHECK (frequency IN ('DAILY','WEEKLY')),
 target_count INTEGER NOT NULL DEFAULT 1 CHECK (target_count > 0),
 current_streak INTEGER NOT NULL DEFAULT 0,
 last_completed_at TIMESTAMPTZ,
 active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)