-- ============================================================================
-- 2026-07-27-patient-file-number
-- Purpose: Hospital feedback item 1 — a separate field for the hospital's own
-- legacy/manual patient file number, distinct from patient_code (which becomes
-- the system-generated MRN as of this same change — see PatientsService.create()).
-- No uniqueness constraint: whether file numbers must be unique per organisation
-- is still an open question sent to the hospital (see scope/ADR conversations);
-- add UNIQUE(organisation_id, file_number) later if/when they confirm.
-- ============================================================================

BEGIN;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS file_number varchar(50) NULL;

COMMENT ON COLUMN patients.file_number IS 'Hospital''s own legacy/manual file number, entered by staff. Distinct from patient_code (system-generated MRN). No uniqueness constraint yet — pending hospital confirmation.';

COMMIT;
