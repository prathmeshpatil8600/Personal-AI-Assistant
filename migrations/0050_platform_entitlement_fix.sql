UPDATE plan_definitions
SET platform_entitlements = CASE code
  WHEN 'PRO' THEN '{"api_access":true,"api_daily_requests":1000}'::jsonb
  WHEN 'PLUS' THEN '{"api_access":false,"api_daily_requests":0}'::jsonb
  ELSE '{"api_access":false,"api_daily_requests":0}'::jsonb
END
WHERE code IN ('FREE','PLUS','PRO');