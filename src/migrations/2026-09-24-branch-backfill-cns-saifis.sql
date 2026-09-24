-- Branch scoping remediation (scope/Branch_Scoping_Remediation_Plan_2026-09-24.md §5, §12):
-- assign NULL-branch rows to the organisation's ONLY live branch, for the two
-- single-branch orgs approved for automatic cleanup (CNS, SAIFIS). Runs before
-- Phase 2, whose Q1 rule hides NULL-branch rows from branch-restricted staff.
--
-- Deliberately NOT generic: PMS (3 branches) needs a per-row human decision;
-- 0-branch orgs keep NULL by design; test orgs untouched. Guarded so it is a
-- no-op if either org gains a second branch before this runs.
--
-- Rollback: not needed for correctness (the branch is the only one the org
-- has); the exact rows touched are listed by RETURNING in the run log.

BEGIN;

CREATE TEMP TABLE _bf_target ON COMMIT DROP AS
SELECT b.organisation_id, b.id AS branch_id
  FROM branches b
 WHERE b.organisation_id IN ('6e82bc9e-4dfb-4192-8cf8-308e0672e20d',  -- CNS Ayurvedic Hospital
                             '0b1f670b-5fc9-4b22-bba8-2ba08b3acd16')  -- SAIFIS HEALTH CARE
   AND b.deleted_at IS NULL
   AND (SELECT count(*) FROM branches x WHERE x.organisation_id = b.organisation_id AND x.deleted_at IS NULL) = 1;

UPDATE patients t          SET branch_id = g.branch_id FROM _bf_target g WHERE t.organisation_id = g.organisation_id AND t.branch_id IS NULL AND t.deleted_at IS NULL RETURNING 'patients', t.id;
UPDATE appointments t      SET branch_id = g.branch_id FROM _bf_target g WHERE t.organisation_id = g.organisation_id AND t.branch_id IS NULL AND t.deleted_at IS NULL RETURNING 'appointments', t.id;
UPDATE patient_bills t     SET branch_id = g.branch_id FROM _bf_target g WHERE t.organisation_id = g.organisation_id AND t.branch_id IS NULL AND t.deleted_at IS NULL RETURNING 'patient_bills', t.id;
UPDATE room_bookings t     SET branch_id = g.branch_id FROM _bf_target g WHERE t.organisation_id = g.organisation_id AND t.branch_id IS NULL AND t.deleted_at IS NULL RETURNING 'room_bookings', t.id;
UPDATE admissions t        SET branch_id = g.branch_id FROM _bf_target g WHERE t.organisation_id = g.organisation_id AND t.branch_id IS NULL RETURNING 'admissions', t.id;
UPDATE rooms t             SET branch_id = g.branch_id FROM _bf_target g WHERE t.organisation_id = g.organisation_id AND t.branch_id IS NULL AND t.deleted_at IS NULL RETURNING 'rooms', t.id;
UPDATE room_categories t   SET branch_id = g.branch_id FROM _bf_target g WHERE t.organisation_id = g.organisation_id AND t.branch_id IS NULL RETURNING 'room_categories', t.id;
UPDATE orders t            SET branch_id = g.branch_id FROM _bf_target g WHERE t.organisation_id = g.organisation_id AND t.branch_id IS NULL RETURNING 'orders', t.id;

COMMIT;
