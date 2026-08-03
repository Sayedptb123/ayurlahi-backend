-- ============================================================================
-- 2026-07-27-branch-approval-status
-- Purpose: ADR-004 D13 — branch creation requires Ayurlahi approval, same
-- pattern as organisation registration. Existing branches (all self-service
-- created before this decision existed) are backfilled as 'approved' — they
-- already exist and are in use; retroactively pending them would break the
-- clinics currently relying on them.
-- ============================================================================

BEGIN;

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS approval_status varchar(20) NOT NULL DEFAULT 'pending';

UPDATE branches SET approval_status = 'approved' WHERE approval_status = 'pending';

COMMENT ON COLUMN branches.approval_status IS 'ADR-004 D13. pending | approved | rejected. New branches default to pending; existing pre-D13 branches were backfilled to approved.';

COMMIT;
