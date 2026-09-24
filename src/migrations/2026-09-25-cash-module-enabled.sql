-- Cash tracking rollout control: Ayurlahi decides which clinics may set up
-- cash tracking. Until cash_module_enabled is true, the clinic's owner/admin
-- cannot seed ledgers, preview or confirm go-live (go-live is one-way).
-- Clinic users cannot change this column; it has no API — the Ayurlahi team
-- sets it:
--   UPDATE organisation_settings SET cash_module_enabled = true, updated_at = now()
--    WHERE organisation_id = '<clinic org id>';
-- Additive: NOT NULL with a false default, so every clinic starts disabled.
--
-- Rollback: ALTER TABLE organisation_settings DROP COLUMN IF EXISTS cash_module_enabled;

BEGIN;

ALTER TABLE organisation_settings
  ADD COLUMN cash_module_enabled BOOLEAN NOT NULL DEFAULT false;

-- A clinic already live (none on staging at the time of writing) stays usable.
UPDATE organisation_settings SET cash_module_enabled = true WHERE cash_module_live_from IS NOT NULL;

COMMIT;
