-- ============================================================================
-- 2026-06-10-module-config
-- Purpose: Add enabled_modules jsonb to clinic_capabilities for per-org
--          module gating (booking, rooms, enquiries, etc.).
--          Idempotent, safe to re-run.
-- ============================================================================

BEGIN;

ALTER TABLE "public"."clinic_capabilities"
    ADD COLUMN IF NOT EXISTS "enabled_modules" JSONB DEFAULT '["postnatal_care","ayurveda","ipd","opd","appointments","billing","staff","inventory","patients","medical_records","prescriptions","lab_reports","analytics","expenses","payroll","tasks","manufacturing","promotions","crm","rooms","booking","enquiries"]'::jsonb;

-- Index for fast module lookups
CREATE INDEX IF NOT EXISTS "idx_clinic_capabilities_modules"
    ON "public"."clinic_capabilities" USING GIN ("enabled_modules");

COMMIT;
