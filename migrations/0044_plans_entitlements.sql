ALTER TABLE usage_events
 ADD COLUMN quota_units INTEGER NOT NULL DEFAULT 0 CHECK (quota_units >= 0),
 ADD COLUMN plan_code TEXT;

CREATE TABLE plan_definitions (
 code TEXT PRIMARY KEY CHECK (code IN ('FREE','PLUS','PRO')),
 display_name TEXT NOT NULL,
 monthly_units INTEGER NOT NULL CHECK (monthly_units > 0),
 entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
 active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_plan_assignments (
 user_id TEXT PRIMARY KEY,
 plan_code TEXT NOT NULL REFERENCES plan_definitions(code),
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','GRACE','PAUSED','CANCELLED')),
 period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month',now()),
 period_end TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month',now()) + interval '1 month',
 unit_bonus INTEGER NOT NULL DEFAULT 0 CHECK (unit_bonus >= 0),
 assigned_by TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK (period_end > period_start)
);

INSERT INTO plan_definitions(code,display_name,monthly_units,entitlements) VALUES
('FREE','Free',200,'{"chat":true,"documents":true,"max_documents":3,"max_memory_items":25,"google_integration":false,"github_integration":false,"scheduled_briefings":false,"advanced_automation":false,"premium_models":false}'::jsonb),
('PLUS','Plus',2000,'{"chat":true,"documents":true,"max_documents":50,"max_memory_items":250,"google_integration":true,"github_integration":true,"scheduled_briefings":true,"advanced_automation":false,"premium_models":false}'::jsonb),
('PRO','Pro',10000,'{"chat":true,"documents":true,"max_documents":250,"max_memory_items":1000,"google_integration":true,"github_integration":true,"scheduled_briefings":true,"advanced_automation":true,"premium_models":true}'::jsonb)
ON CONFLICT(code) DO NOTHING;

UPDATE usage_events
SET quota_units = CASE
 WHEN event_type='ai_generation' THEN GREATEST(1,CEIL((COALESCE(input_tokens,0)+COALESCE(output_tokens,0))/1000.0)::int)
 WHEN event_type='document_ingest' THEN GREATEST(1,CEIL(COALESCE(bytes_processed,0)/1048576.0)::int + COALESCE(item_count,0))
 WHEN event_type='embedding_query' THEN 1
 WHEN event_type='tool_execution' THEN CASE WHEN COALESCE(metadata->>'status','')='BLOCKED' THEN 0 ELSE 1 END
 ELSE GREATEST(1,COALESCE(item_count,1))
END
WHERE quota_units=0;

CREATE INDEX user_plan_assignments_plan_idx ON user_plan_assignments(plan_code,status);
CREATE INDEX usage_events_user_period_units_idx ON usage_events(user_id,occurred_at) INCLUDE (quota_units);