CREATE TABLE memories (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL,
 category TEXT NOT NULL DEFAULT 'general',
 memory_key TEXT NOT NULL,
 memory_value TEXT NOT NULL,
 source TEXT NOT NULL DEFAULT 'user',
 importance INTEGER NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(user_id, memory_key)
)