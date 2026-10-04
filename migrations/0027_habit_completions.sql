CREATE TABLE habit_completions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL,
 completed_on DATE NOT NULL,
 completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(user_id,habit_id,completed_on)
)