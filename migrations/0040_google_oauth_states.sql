CREATE TABLE google_oauth_states (
 state TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 redirect_uri TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
)