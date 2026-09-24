-- Re-assigning a staff member to a branch they were previously removed from
-- 500'd: remove() soft-deletes the assignment (deleted_at) but left
-- is_active = true, and the partial unique index only checked is_active, so
-- the deleted row still "occupied" (staff_id, branch_id). Hit on PMS
-- (toggle Main off, then on again, in Staff > Branches).
--
-- 1. Soft-deleted assignments are not active (remove() now sets this too).
-- 2. The unique index ignores soft-deleted rows.
--
-- Rollback: recreate the index with WHERE is_active = true (the is_active
-- backfill on deleted rows needs no rollback -- deleted rows are never read).

BEGIN;
UPDATE staff_branch_assignments
   SET is_active = false
 WHERE deleted_at IS NOT NULL AND is_active = true;

DROP INDEX IF EXISTS idx_staff_branch_unique_active;
CREATE UNIQUE INDEX idx_staff_branch_unique_active
    ON staff_branch_assignments (staff_id, branch_id)
 WHERE is_active = true AND deleted_at IS NULL;
COMMIT;
