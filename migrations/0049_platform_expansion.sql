ALTER TABLE plan_definitions
 ADD COLUMN IF NOT EXISTS platform_entitlements JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE plan_definitions SET platform_entitlements=
 CASE code
  WHEN 'PRO' THEN '{"api_access":true,"api_daily_requests":1000}'::jsonb
  ELSE '{"api_access":false,"api_daily_requests":0}'::jsonb
 END;

CREATE TABLE developer_api_keys (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL,
 organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
 key_prefix TEXT NOT NULL,
 key_hash TEXT NOT NULL UNIQUE,
 scopes JSONB NOT NULL DEFAULT '["profile:read"]'::jsonb,
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED','EXPIRED')),
 expires_at TIMESTAMPTZ,
 last_used_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 revoked_at TIMESTAMPTZ
);

CREATE TABLE developer_api_usage_daily (
 api_key_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
 usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
 request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
 PRIMARY KEY(api_key_id,usage_date)
);

CREATE TABLE white_label_profiles (
 organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 brand_name TEXT NOT NULL CHECK (length(brand_name) BETWEEN 2 AND 80),
 accent_key TEXT NOT NULL DEFAULT 'forest' CHECK (accent_key IN ('forest','indigo','ocean','amber','rose')),
 logo_url TEXT,
 support_email TEXT,
 welcome_message TEXT NOT NULL DEFAULT '',
 enabled BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE integration_marketplace (
 slug TEXT PRIMARY KEY CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
 display_name TEXT NOT NULL,
 description TEXT NOT NULL,
 category TEXT NOT NULL,
 provider TEXT NOT NULL,
 permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
 status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','COMING_SOON','DISABLED')),
 install_mode TEXT NOT NULL DEFAULT 'NATIVE' CHECK (install_mode IN ('NATIVE','MANAGED')),
 sort_order INTEGER NOT NULL DEFAULT 100,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE integration_installations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 integration_slug TEXT NOT NULL REFERENCES integration_marketplace(slug),
 installed_by TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED','REMOVED')),
 granted_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
 installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(organization_id,integration_slug)
);

CREATE TABLE partner_codes (
 code TEXT PRIMARY KEY CHECK (code ~ '^[A-Z0-9_-]{3,32}$'),
 partner_name TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','REVOKED')),
 campaign TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE referral_attributions (
 user_id TEXT PRIMARY KEY,
 partner_code TEXT NOT NULL REFERENCES partner_codes(code),
 attributed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 source TEXT NOT NULL DEFAULT 'signup',
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO integration_marketplace(slug,display_name,description,category,provider,permissions,status,install_mode,sort_order) VALUES
('google-workspace','Google Workspace','Gmail, Calendar and Drive integration.','Productivity','google','["gmail.read","gmail.send_approved","calendar.read","calendar.write_approved","drive.metadata.read"]'::jsonb,'AVAILABLE','NATIVE',10),
('github','GitHub','Repository, issue and pull-request workflows.','Developer','github','["metadata.read","contents.read","issues.read","issues.write_approved","pull_requests.read"]'::jsonb,'AVAILABLE','NATIVE',20),
('slack','Slack','Team messaging connector foundation.','Communication','slack','["channels.read","messages.read"]'::jsonb,'COMING_SOON','MANAGED',30),
('notion','Notion','Workspace knowledge connector foundation.','Knowledge','notion','["pages.read"]'::jsonb,'COMING_SOON','MANAGED',40)
ON CONFLICT(slug) DO NOTHING;

CREATE OR REPLACE FUNCTION enforce_developer_api_key_limit()
RETURNS trigger AS $$
DECLARE active_keys INTEGER;
BEGIN
 IF NEW.status <> 'ACTIVE' OR NEW.organization_id IS NOT NULL THEN RETURN NEW; END IF;
 SELECT count(*) INTO active_keys
 FROM developer_api_keys
 WHERE user_id=NEW.user_id AND organization_id IS NULL AND status='ACTIVE'
   AND id<>NEW.id;
 IF active_keys>=5 THEN
  RAISE EXCEPTION 'developer_api_key_limit_reached' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER developer_api_key_limit_guard
BEFORE INSERT OR UPDATE OF status ON developer_api_keys
FOR EACH ROW EXECUTE FUNCTION enforce_developer_api_key_limit();

CREATE INDEX developer_api_keys_user_idx ON developer_api_keys(user_id,status);
CREATE INDEX integration_installations_org_idx ON integration_installations(organization_id,status);
CREATE INDEX referral_attributions_partner_idx ON referral_attributions(partner_code,attributed_at);