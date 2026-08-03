-- ============================================================================
-- 2026-08-04-branch-owned-setup-catalog
-- Purpose: ADR-004 D15 — Room Categories, Treatment Packages, Pricing Matrix
-- (room_category_pricing + room_pricing_overrides), and Duty Types become
-- branch-owned setup catalog. Unlike D9's branch_id columns, NULL here does
-- NOT mean "organisation-wide" — it means "needs branch assignment" (a
-- legacy row predating this decision). Also backfills duty_templates.branch_id,
-- which already existed (nullable, from an earlier pass) but was never
-- required or populated.
--
-- Backfill rule: organisations with exactly ONE approved branch get their
-- existing rows auto-assigned to that branch (zero disruption — this is the
-- common case). Organisations with 2+ branches are left NULL — there's no
-- safe way to guess which branch an existing row belongs to; those owners
-- resolve it manually via each entity's existing edit screen (surfaced via a
-- "needs branch assignment" badge + Dashboard stat card, app-layer only).
--
-- Schema only, still nullable at the DB layer — enforcement that NEW rows
-- must have a branch lives in the service layer (every write path, including
-- the Excel importer), not a DB constraint. See D15 for the full rationale.
-- ============================================================================

BEGIN;

ALTER TABLE room_categories       ADD COLUMN IF NOT EXISTS branch_id uuid NULL REFERENCES branches(id);
ALTER TABLE treatment_packages    ADD COLUMN IF NOT EXISTS branch_id uuid NULL REFERENCES branches(id);
ALTER TABLE room_category_pricing ADD COLUMN IF NOT EXISTS branch_id uuid NULL REFERENCES branches(id);
ALTER TABLE room_pricing_overrides ADD COLUMN IF NOT EXISTS branch_id uuid NULL REFERENCES branches(id);
ALTER TABLE duty_types            ADD COLUMN IF NOT EXISTS branch_id uuid NULL REFERENCES branches(id);
-- duty_templates.branch_id already exists (baseline-2026-05-31) — backfill only, no ALTER.

CREATE INDEX IF NOT EXISTS idx_room_categories_org_branch        ON room_categories        (organisation_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_treatment_packages_org_branch     ON treatment_packages     (organisation_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_room_category_pricing_org_branch  ON room_category_pricing  (organisation_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_room_pricing_overrides_org_branch ON room_pricing_overrides (organisation_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_duty_types_org_branch             ON duty_types             (organisation_id, branch_id);

COMMENT ON COLUMN room_categories.branch_id        IS 'ADR-004 D15. NULL = needs branch assignment (legacy row), NEVER "shared" — do not OR-NULL this like D9 columns.';
COMMENT ON COLUMN treatment_packages.branch_id     IS 'ADR-004 D15. NULL = needs branch assignment (legacy row), NEVER "shared" — do not OR-NULL this like D9 columns.';
COMMENT ON COLUMN room_category_pricing.branch_id  IS 'ADR-004 D15. Denormalized from room_category/package at write time (both must already agree). NULL = needs branch assignment, NEVER "shared".';
COMMENT ON COLUMN room_pricing_overrides.branch_id IS 'ADR-004 D15. Denormalized from room/package at write time (both must already agree). NULL = needs branch assignment, NEVER "shared".';
COMMENT ON COLUMN duty_types.branch_id             IS 'ADR-004 D15. NULL = needs branch assignment (legacy row), NEVER "shared" — do not OR-NULL this like D9 columns. Deliberately not cross-checked against duty_assignments.branch_id.';

-- ── Backfill: single-branch organisations only ──────────────────────────────
-- An org "has exactly one branch" = exactly one row in branches with
-- approval_status = 'approved' and deleted_at IS NULL.

WITH single_branch_orgs AS (
  SELECT organisation_id, MIN(id::text)::uuid AS only_branch_id
  FROM branches
  WHERE approval_status = 'approved' AND deleted_at IS NULL
  GROUP BY organisation_id
  HAVING COUNT(*) = 1
)
UPDATE room_categories rc
SET branch_id = sbo.only_branch_id
FROM single_branch_orgs sbo
WHERE rc.organisation_id = sbo.organisation_id AND rc.branch_id IS NULL;

WITH single_branch_orgs AS (
  SELECT organisation_id, MIN(id::text)::uuid AS only_branch_id
  FROM branches
  WHERE approval_status = 'approved' AND deleted_at IS NULL
  GROUP BY organisation_id
  HAVING COUNT(*) = 1
)
UPDATE treatment_packages tp
SET branch_id = sbo.only_branch_id
FROM single_branch_orgs sbo
WHERE tp.organisation_id = sbo.organisation_id AND tp.branch_id IS NULL;

WITH single_branch_orgs AS (
  SELECT organisation_id, MIN(id::text)::uuid AS only_branch_id
  FROM branches
  WHERE approval_status = 'approved' AND deleted_at IS NULL
  GROUP BY organisation_id
  HAVING COUNT(*) = 1
)
UPDATE room_category_pricing rcp
SET branch_id = sbo.only_branch_id
FROM single_branch_orgs sbo
WHERE rcp.organisation_id = sbo.organisation_id AND rcp.branch_id IS NULL;

WITH single_branch_orgs AS (
  SELECT organisation_id, MIN(id::text)::uuid AS only_branch_id
  FROM branches
  WHERE approval_status = 'approved' AND deleted_at IS NULL
  GROUP BY organisation_id
  HAVING COUNT(*) = 1
)
UPDATE room_pricing_overrides rpo
SET branch_id = sbo.only_branch_id
FROM single_branch_orgs sbo
WHERE rpo.organisation_id = sbo.organisation_id AND rpo.branch_id IS NULL;

WITH single_branch_orgs AS (
  SELECT organisation_id, MIN(id::text)::uuid AS only_branch_id
  FROM branches
  WHERE approval_status = 'approved' AND deleted_at IS NULL
  GROUP BY organisation_id
  HAVING COUNT(*) = 1
)
UPDATE duty_types dt
SET branch_id = sbo.only_branch_id
FROM single_branch_orgs sbo
WHERE dt.organisation_id = sbo.organisation_id AND dt.branch_id IS NULL;

WITH single_branch_orgs AS (
  SELECT organisation_id, MIN(id::text)::uuid AS only_branch_id
  FROM branches
  WHERE approval_status = 'approved' AND deleted_at IS NULL
  GROUP BY organisation_id
  HAVING COUNT(*) = 1
)
UPDATE duty_templates dtmpl
SET branch_id = sbo.only_branch_id
FROM single_branch_orgs sbo
WHERE dtmpl.organisation_id = sbo.organisation_id AND dtmpl.branch_id IS NULL;

COMMIT;
