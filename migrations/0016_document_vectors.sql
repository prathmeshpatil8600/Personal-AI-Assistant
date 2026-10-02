CREATE TABLE document_vectors (
 document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL,
 chunk_index INTEGER NOT NULL,
 embedding vector(1536) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY (document_id, chunk_index)
)