-- ============================================================================
-- 2026-07-27-branch-approval-audit-fields
-- Purpose: ADR-004 D13 follow-up — the approve()/reject() workflow needs
-- somewhere to record who decided and why, mirroring organisations' exact
-- shape (rejection_reason, approved_at, approved_by). Not in D13's original
-- schema summary (which only listed approval_status) but required for the
-- workflow it describes to be functionally complete.
-- ============================================================================

BEGIN;

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS rejection_reason text NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamp NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid NULL;

COMMIT;
