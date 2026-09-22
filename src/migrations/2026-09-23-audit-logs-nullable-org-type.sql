-- Same reasoning as 2026-09-23-audit-logs-nullable-org.sql: an
-- org-unscoped security event ("no account matches this identifier at
-- all") has no organisation, and therefore no org_type to denormalize
-- either. Caught immediately after the organisation_id fix while wiring
-- AuditService's AuditParams type to match -- both nullable columns
-- represent the same underlying case, not two separate ones.

BEGIN;

ALTER TABLE audit_logs ALTER COLUMN org_type DROP NOT NULL;

COMMIT;
