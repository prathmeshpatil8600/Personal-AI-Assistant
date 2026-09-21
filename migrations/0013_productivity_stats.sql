CREATE TABLE productivity_daily (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL,
 stat_date DATE NOT NULL,
 tasks_created INTEGER NOT NULL DEFAULT 0,
 tasks_completed INTEGER NOT NULL DEFAULT 0,
 tasks_overdue INTEGER NOT NULL DEFAULT 0,
 notes_created INTEGER NOT NULL DEFAULT 0,
 events_count INTEGER NOT NULL DEFAULT 0,
 reminders_due INTEGER NOT NULL DEFAULT 0,
 focus_minutes INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(user_id,stat_date)
)