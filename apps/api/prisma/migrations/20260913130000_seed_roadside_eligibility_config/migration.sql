-- Roadside eligibility defaults. `SystemConfig` already backs admin-managed
-- operational policy; seed these keys so the existing behaviour is explicit
-- and editable without deploying code. ON CONFLICT preserves any environment
-- that has already chosen a different policy.
INSERT INTO "system_config" ("key", "value", "updated_at")
VALUES
  ('roadside_waiting_days', '30', CURRENT_TIMESTAMP),
  ('roadside_require_cleared_payment', 'true', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
