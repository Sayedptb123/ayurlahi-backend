-- Follow-up to 2026-09-23-create-audit-logs.sql, found while wiring Auth
-- instrumentation (scope/Audit_Trail_Phase1_Auth_Implementation_Plan.md).
--
-- organisation_id was specified NOT NULL, but tracing the actual code in
-- auth.service.ts's login()/requestOtp() found real events with no
-- organisation to attach: a login or OTP-request attempt against an
-- identifier that matches no account at all has no user row, and
-- therefore no organisation membership to look up -- there is nothing to
-- put in this column for that one case. These become org-unscoped
-- security-event rows, found by actor_user_id IS NULL + action
-- ('login_failed' / 'otp_request_failed'), not by organisation_id.

BEGIN;

ALTER TABLE audit_logs ALTER COLUMN organisation_id DROP NOT NULL;

COMMIT;
