-- ============================================================================
-- 2026-06-11-admission-care-program
-- Purpose: Add care_program to admissions as the admission-level classifier for
--          which care program a stay belongs to (postnatal, ayurveda, ipd, opd…).
--          Plain VARCHAR (NOT a PG enum) so new programs are data-driven, never
--          a migration. Validated in-app against the org's clinic_capabilities.
--          Classification layer ONLY — does not touch occupancy/room logic
--          (D5/D10 untouched; room_id stays NOT NULL).
--
-- Backfill: intentionally left NULL. Existing admissions are all booking/retreat
--           (Ayurveda IPD) stays; postnatal never created admissions before this,
--           so there are no postnatal rows to backfill. Going forward checkIn()
--           defaults care_program from capabilities (single-program) or sets it
--           explicitly (postnatal intake passes 'postnatal').
--
--          Idempotent, safe to re-run.
-- ============================================================================

BEGIN;

ALTER TABLE "public"."admissions"
    ADD COLUMN IF NOT EXISTS "care_program" VARCHAR(50);

-- Roster query path: ACTIVE postnatal admissions per org (POSTNATAL-W1-A.2)
CREATE INDEX IF NOT EXISTS "idx_admissions_org_status_care_program"
    ON "public"."admissions" ("organisation_id", "status", "care_program");

COMMIT;
