CREATE TABLE documents (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL,
 title TEXT NOT NULL,
 filename TEXT NOT NULL,
 content_type TEXT NOT NULL DEFAULT 'text/plain',
 storage_key TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'READY' CHECK (status IN ('PROCESSING','READY','ERROR')),
 error_message TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)