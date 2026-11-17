CREATE TABLE launch_manual_checks (
  check_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO launch_manual_checks(check_key,label) VALUES
 ('legal_identity','Operator identity and support/privacy/grievance contacts finalized'),
 ('legal_review','Privacy Notice and Terms reviewed for commercial launch'),
 ('refund_policy','Refund and cancellation policy finalized'),
 ('tax_review','GST/tax/invoicing treatment confirmed'),
 ('database_recovery','Production database backup and restore procedure verified'),
 ('platform_identity_deletion','Hatchable end-user identity deletion procedure documented'),
 ('production_domain','Production domain / canonical URL finalized'),
 ('browser_qa','Desktop and mobile browser QA completed'),
 ('multi_user_isolation','Final two-account data-isolation test completed')
ON CONFLICT(check_key) DO NOTHING;