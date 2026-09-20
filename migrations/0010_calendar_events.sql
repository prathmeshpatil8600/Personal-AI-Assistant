CREATE TABLE calendar_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL,
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 start_at TIMESTAMPTZ NOT NULL,
 end_at TIMESTAMPTZ,
 all_day BOOLEAN NOT NULL DEFAULT false,
 location TEXT NOT NULL DEFAULT '',
 recurrence TEXT,
 reminder_minutes INTEGER NOT NULL DEFAULT 15,
 status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','CANCELLED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)