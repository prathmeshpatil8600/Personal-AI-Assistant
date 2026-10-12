CREATE TABLE IF NOT EXISTS user_rate_limits (
  user_id TEXT NOT NULL,
  bucket_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS user_rate_limits_window_idx
  ON user_rate_limits(window_start);