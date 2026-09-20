CREATE TABLE conversation_messages (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL,
 role TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')),
 content TEXT NOT NULL DEFAULT '',
 tool_calls JSONB,
 tool_results JSONB,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)