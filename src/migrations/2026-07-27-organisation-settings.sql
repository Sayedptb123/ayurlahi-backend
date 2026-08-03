-- ============================================================================
-- 2026-07-27-organisation-settings
-- Purpose: ADR-004 D12 — a 1:1 satellite table for per-organisation operational
-- policy (patient visibility, staff assignment, billing, reporting, inventory,
-- numbering, appointment sharing), separate from `organisations` (identity) so
-- the tenant table doesn't become a god-table as more policies are added.
-- Only patient_visibility and staff_policy are ever exposed to the customer
-- (ADR-004 D2) — the rest are internal defaults for now.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS organisation_settings (
  organisation_id      uuid PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  patient_visibility    varchar(20) NOT NULL DEFAULT 'isolated',     -- 'shared' | 'isolated'
  staff_policy          varchar(20) NOT NULL DEFAULT 'multi_branch', -- 'multi_branch' | 'single_branch'
  billing_policy        varchar(20) NOT NULL DEFAULT 'per_branch',   -- fixed at launch, not customer-editable
  reporting_policy      varchar(20) NOT NULL DEFAULT 'both',         -- fixed at launch, not customer-editable
  inventory_policy      varchar(20) NOT NULL DEFAULT 'shared',       -- unexposed until inventory module exists
  numbering_policy      varchar(20) NOT NULL DEFAULT 'org_wide',     -- scope only; format deferred (D7)
  appointment_policy    varchar(20) NOT NULL DEFAULT 'auto',         -- 'auto' | 'custom' (custom unimplemented)
  created_at            timestamp NOT NULL DEFAULT now(),
  updated_at            timestamp NOT NULL DEFAULT now()
);

-- Backfill a default row for every organisation that already exists — new
-- organisations get one created inline in OrganisationsService.create() from
-- this point forward, but existing orgs predate that code path.
INSERT INTO organisation_settings (organisation_id)
SELECT id FROM organisations
ON CONFLICT (organisation_id) DO NOTHING;

COMMIT;
