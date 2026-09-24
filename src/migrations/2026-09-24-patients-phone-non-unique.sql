-- Patients may share a phone number (families, caregivers). Phone is a
-- contact/search attribute, not patient identity. Replaces the org-wide
-- UNIQUE index with a plain lookup index on the same columns.
-- See scope/patient-phone-non-unique-and-matching.md.
--
-- Apply only after booking promotion stops auto-linking by phone
-- (RetreatService.promoteEnquiry) is running -- otherwise promotion could
-- silently link to an arbitrary one of several same-phone patients.
--
-- Rollback (only valid while no two live patients in an org share a phone):
--   DROP INDEX IF EXISTS idx_patients_org_phone;
--   CREATE UNIQUE INDEX idx_patients_org_phone_unique ON patients (organisation_id, phone)
--     WHERE deleted_at IS NULL AND phone IS NOT NULL;

BEGIN;
DROP INDEX IF EXISTS idx_patients_org_phone_unique;
CREATE INDEX IF NOT EXISTS idx_patients_org_phone ON patients (organisation_id, phone)
  WHERE deleted_at IS NULL AND phone IS NOT NULL;
COMMIT;
