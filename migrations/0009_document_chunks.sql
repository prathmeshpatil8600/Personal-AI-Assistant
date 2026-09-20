CREATE TABLE document_chunks (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL,
 chunk_index INTEGER NOT NULL,
 content TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(document_id, chunk_index)
)