CREATE TABLE billing_subscriptions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL UNIQUE,
 provider TEXT NOT NULL DEFAULT 'razorpay',
 plan_code TEXT NOT NULL CHECK (plan_code IN ('PLUS','PRO')),
 billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('MONTHLY','ANNUAL')),
 provider_subscription_id TEXT UNIQUE,
 provider_plan_id TEXT,
 status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED','AUTHENTICATED','ACTIVE','PAST_DUE','PAUSED','CANCELLED','COMPLETED','EXPIRED')),
 current_period_start TIMESTAMPTZ,
 current_period_end TIMESTAMPTZ,
 cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
 cancelled_at TIMESTAMPTZ,
 last_payment_id TEXT,
 last_invoice_id TEXT,
 last_event_at TIMESTAMPTZ,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE billing_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 provider TEXT NOT NULL,
 provider_event_id TEXT,
 event_type TEXT NOT NULL,
 provider_subscription_id TEXT,
 user_id TEXT,
 payload_hash TEXT NOT NULL,
 verified BOOLEAN NOT NULL DEFAULT false,
 processed BOOLEAN NOT NULL DEFAULT false,
 processing_error TEXT,
 occurred_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 processed_at TIMESTAMPTZ,
 UNIQUE(provider,payload_hash)
);

CREATE INDEX billing_subscriptions_user_status_idx ON billing_subscriptions(user_id,status);
CREATE INDEX billing_events_subscription_idx ON billing_events(provider_subscription_id,created_at DESC);
CREATE INDEX billing_events_user_idx ON billing_events(user_id,created_at DESC);