CREATE TABLE assistant_notifications (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL,
 type TEXT NOT NULL DEFAULT 'INFO',
 title TEXT NOT NULL,
 message TEXT NOT NULL DEFAULT '',
 source_key TEXT NOT NULL,
 read_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(user_id,source_key)
)