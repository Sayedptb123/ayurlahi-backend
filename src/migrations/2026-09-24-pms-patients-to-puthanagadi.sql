-- Branch scoping Phase 6 (scope/Branch_Scoping_Remediation_Plan_2026-09-24.md):
-- PMS's two NULL-branch patients, created 2026-09-22 by the PMS manager from
-- the Register Patient form while the branch switcher had no selection.
-- No linked record carried a branch, so they were held for a human decision;
-- the user confirmed on 2026-09-24 that both belong to Puthanagadi.
--
-- Scope is exactly these two rows (ids pinned, still NULL-branch, live).
-- PMS's 8 NULL-branch orders and 2 packages are deliberately left untouched.
--
-- Rollback: UPDATE patients SET branch_id = NULL
--            WHERE id IN ('fa0e642c-0c86-4107-9978-e7db22050399', 'b925886a-7666-449a-9413-68d3b6fcf210');

BEGIN;
UPDATE patients
   SET branch_id = '0d2f4b7c-7704-470d-a43e-c5cb79c3d89b'   -- Puthanagadi
 WHERE organisation_id = '30164e3d-11a1-4820-823b-d0c2ba1dd9c0' -- PMS Ayurvedic Group
   AND id IN ('fa0e642c-0c86-4107-9978-e7db22050399',        -- P00010 Dua Kareem
              'b925886a-7666-449a-9413-68d3b6fcf210')        -- P00008 Najeeba P
   AND branch_id IS NULL
   AND deleted_at IS NULL
RETURNING patient_code, branch_id;
COMMIT;
