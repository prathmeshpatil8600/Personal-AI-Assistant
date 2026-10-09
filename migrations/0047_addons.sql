CREATE TABLE addon_catalog (
 code TEXT PRIMARY KEY,
 display_name TEXT NOT NULL,
 description TEXT NOT NULL,
 price_inr INTEGER NOT NULL CHECK (price_inr > 0),
 effects JSONB NOT NULL,
 eligible_plans JSONB NOT NULL DEFAULT '["FREE","PLUS","PRO"]'::jsonb,
 validity_days INTEGER CHECK (validity_days IS NULL OR validity_days > 0),
 active BOOLEAN NOT NULL DEFAULT true,
 sort_order INTEGER NOT NULL DEFAULT 100,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE addon_orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL,
 addon_code TEXT NOT NULL REFERENCES addon_catalog(code),
 provider TEXT NOT NULL DEFAULT 'razorpay',
 provider_order_id TEXT NOT NULL UNIQUE,
 provider_payment_id TEXT UNIQUE,
 amount_inr INTEGER NOT NULL CHECK (amount_inr > 0),
 currency TEXT NOT NULL DEFAULT 'INR',
 status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED','PAID','FAILED','REFUNDED','CANCELLED')),
 paid_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE addon_grants (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL,
 addon_code TEXT NOT NULL REFERENCES addon_catalog(code),
 addon_order_id UUID REFERENCES addon_orders(id) ON DELETE SET NULL,
 source TEXT NOT NULL CHECK (source IN ('PURCHASE','ADMIN','PROMOTION')),
 effects JSONB NOT NULL,
 starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ,
 revoked_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(addon_order_id)
);

CREATE INDEX addon_orders_user_idx ON addon_orders(user_id,created_at DESC);
CREATE INDEX addon_grants_user_active_idx ON addon_grants(user_id,expires_at) WHERE revoked_at IS NULL;

INSERT INTO addon_catalog(code,display_name,description,price_inr,effects,eligible_plans,validity_days,sort_order) VALUES
('AI_500','AI Boost 500','500 extra usage units for 31 days.',199,'{"quota_units":500}'::jsonb,'["FREE","PLUS","PRO"]'::jsonb,31,10),
('DOC_25','Document Pack 25','25 additional document slots for 31 days.',149,'{"max_documents":25}'::jsonb,'["FREE","PLUS","PRO"]'::jsonb,31,20),
('AUTOMATION_100','Automation Pack','100 extra usage units plus temporary advanced automation access.',299,'{"quota_units":100,"feature_flags":["advanced_automation"]}'::jsonb,'["PLUS","PRO"]'::jsonb,31,30)
ON CONFLICT(code) DO NOTHING;