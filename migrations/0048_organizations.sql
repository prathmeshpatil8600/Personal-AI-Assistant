CREATE TABLE organizations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
 slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
 owner_user_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','CANCELLED')),
 seat_limit INTEGER NOT NULL DEFAULT 5 CHECK (seat_limit BETWEEN 1 AND 10000),
 business_tier TEXT NOT NULL DEFAULT 'BUSINESS_TRIAL' CHECK (business_tier IN ('BUSINESS_TRIAL','BUSINESS_CUSTOM')),
 entitlements JSONB NOT NULL DEFAULT '{"shared_workspace":true,"team_memory":false,"admin_controls":true,"audit_log":true,"priority_support":false}'::jsonb,
 billing_status TEXT NOT NULL DEFAULT 'TRIAL' CHECK (billing_status IN ('TRIAL','ACTIVE','PAST_DUE','PAUSED','CANCELLED')),
 trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '30 days',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization_memberships (
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL,
 role TEXT NOT NULL CHECK (role IN ('OWNER','ADMIN','MEMBER','BILLING')),
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','REMOVED')),
 joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,user_id)
);

CREATE TABLE organization_invites (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 email_hint TEXT,
 role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('ADMIN','MEMBER','BILLING')),
 created_by TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '7 days',
 accepted_by TEXT,
 accepted_at TIMESTAMPTZ,
 revoked_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization_billing_accounts (
 organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 provider TEXT,
 provider_subscription_id TEXT UNIQUE,
 billing_cycle TEXT CHECK (billing_cycle IS NULL OR billing_cycle IN ('MONTHLY','ANNUAL')),
 seat_quantity INTEGER NOT NULL DEFAULT 5 CHECK (seat_quantity BETWEEN 1 AND 10000),
 price_inr_per_seat INTEGER CHECK (price_inr_per_seat IS NULL OR price_inr_per_seat >= 0),
 status TEXT NOT NULL DEFAULT 'TRIAL' CHECK (status IN ('TRIAL','CREATED','ACTIVE','PAST_DUE','PAUSED','CANCELLED')),
 current_period_start TIMESTAMPTZ,
 current_period_end TIMESTAMPTZ,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization_workspaces (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
 name TEXT NOT NULL DEFAULT 'Shared workspace',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization_shared_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 workspace_id UUID NOT NULL REFERENCES organization_workspaces(id) ON DELETE CASCADE,
 item_type TEXT NOT NULL CHECK (item_type IN ('NOTE','TASK','LINK','DECISION')),
 title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
 content TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DONE','ARCHIVED')),
 created_by TEXT NOT NULL,
 updated_by TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization_audit_log (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 actor_user_id TEXT NOT NULL,
 action TEXT NOT NULL,
 target_type TEXT,
 target_id TEXT,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION enforce_organization_seat_limit()
RETURNS trigger AS $$
DECLARE
  allowed_seats INTEGER;
  used_seats INTEGER;
BEGIN
  IF NEW.status <> 'ACTIVE' THEN
    RETURN NEW;
  END IF;

  SELECT seat_limit INTO allowed_seats
  FROM organizations
  WHERE id = NEW.organization_id
  FOR UPDATE;

  SELECT count(*) INTO used_seats
  FROM organization_memberships
  WHERE organization_id = NEW.organization_id
    AND status = 'ACTIVE'
    AND user_id <> NEW.user_id;

  IF used_seats >= allowed_seats THEN
    RAISE EXCEPTION 'organization_seat_limit_reached' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organization_membership_seat_guard
BEFORE INSERT OR UPDATE OF status,organization_id ON organization_memberships
FOR EACH ROW EXECUTE FUNCTION enforce_organization_seat_limit();

CREATE INDEX organization_memberships_user_idx ON organization_memberships(user_id,status);
CREATE OR REPLACE FUNCTION accept_organization_invite_atomic(p_token_hash TEXT,p_user_id TEXT)
RETURNS TABLE(organization_id UUID,organization_name TEXT,member_role TEXT) AS $$
DECLARE
  inv organization_invites%ROWTYPE;
  org organizations%ROWTYPE;
  seats INTEGER;
  existing organization_memberships%ROWTYPE;
BEGIN
  SELECT * INTO inv
  FROM organization_invites
  WHERE token_hash=p_token_hash
    AND revoked_at IS NULL
    AND accepted_at IS NULL
    AND expires_at>now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_invalid' USING ERRCODE='23514';
  END IF;

  SELECT * INTO org
  FROM organizations
  WHERE id=inv.organization_id
  FOR UPDATE;

  IF NOT FOUND OR org.status<>'ACTIVE' THEN
    RAISE EXCEPTION 'organization_unavailable' USING ERRCODE='23514';
  END IF;

  SELECT * INTO existing
  FROM organization_memberships
  WHERE organization_id=org.id AND user_id=p_user_id
  FOR UPDATE;

  IF FOUND AND existing.status='ACTIVE' THEN
    RAISE EXCEPTION 'already_member' USING ERRCODE='23514';
  END IF;

  SELECT count(*) INTO seats
  FROM organization_memberships
  WHERE organization_id=org.id AND status='ACTIVE';

  IF seats>=org.seat_limit THEN
    RAISE EXCEPTION 'organization_seat_limit_reached' USING ERRCODE='23514';
  END IF;

  INSERT INTO organization_memberships(organization_id,user_id,role,status)
  VALUES(org.id,p_user_id,inv.role,'ACTIVE')
  ON CONFLICT(organization_id,user_id)
  DO UPDATE SET role=EXCLUDED.role,status='ACTIVE',updated_at=now();

  UPDATE organization_invites
  SET accepted_by=p_user_id,accepted_at=now()
  WHERE id=inv.id;

  RETURN QUERY SELECT org.id,org.name,inv.role;
END;
$$ LANGUAGE plpgsql;

CREATE INDEX organization_invites_org_idx ON organization_invites(organization_id,expires_at DESC);
CREATE INDEX organization_shared_items_org_idx ON organization_shared_items(organization_id,updated_at DESC);
CREATE INDEX organization_audit_org_idx ON organization_audit_log(organization_id,created_at DESC);