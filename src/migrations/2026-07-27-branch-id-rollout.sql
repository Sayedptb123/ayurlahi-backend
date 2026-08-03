-- ============================================================================
-- 2026-07-27-branch-id-rollout
-- Purpose: ADR-004 D9 (+ D14 amendment) — add branch_id to the patient-root
-- and money-root tables (D9), plus rooms (D14, physical-location ownership,
-- separate grounds from D9's derivation rule). Schema only — no query-layer
-- enforcement yet (that's Phase 4). All nullable; NULL means "organisation-wide",
-- per D9's semantics. Nothing reads this column yet, so this migration is a
-- zero-behavior-change, safe-to-ship-alone change.
--
-- Note: rooms.branch_id already exists (added by an earlier, undocumented
-- change) but has no index and is unused anywhere in the codebase — this
-- migration only adds the missing index for it.
-- ============================================================================

BEGIN;

ALTER TABLE patients      ADD COLUMN IF NOT EXISTS branch_id uuid NULL REFERENCES branches(id);
ALTER TABLE patient_bills ADD COLUMN IF NOT EXISTS branch_id uuid NULL REFERENCES branches(id);
ALTER TABLE room_bookings ADD COLUMN IF NOT EXISTS branch_id uuid NULL REFERENCES branches(id);
ALTER TABLE admissions    ADD COLUMN IF NOT EXISTS branch_id uuid NULL REFERENCES branches(id);
-- rooms.branch_id already exists — no ALTER needed, index only (below).

CREATE INDEX IF NOT EXISTS idx_patients_org_branch      ON patients      (organisation_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_patient_bills_org_branch ON patient_bills (organisation_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_room_bookings_org_branch ON room_bookings (organisation_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_admissions_org_branch    ON admissions    (organisation_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_rooms_org_branch         ON rooms         (organisation_id, branch_id);

COMMENT ON COLUMN patients.branch_id      IS 'ADR-004 D9. NULL = organisation-wide, visible regardless of patientVisibility policy.';
COMMENT ON COLUMN patient_bills.branch_id IS 'ADR-004 D9. NULL = organisation-wide.';
COMMENT ON COLUMN room_bookings.branch_id IS 'ADR-004 D9. NULL = organisation-wide.';
COMMENT ON COLUMN admissions.branch_id    IS 'ADR-004 D9. NULL = organisation-wide.';
COMMENT ON COLUMN rooms.branch_id         IS 'ADR-004 D14. Physical-location ownership — a room exists in exactly one branch, not derived from a patient/bill.';

COMMIT;
