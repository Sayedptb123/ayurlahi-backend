-- ============================================================================
-- 2026-06-04-crm-sales-roles
-- Purpose: Allow the new Sales CRM roles on organisation_users.role.
--          TELECALLER / FIELD_STAFF / TEAM_LEAD / SALES_MANAGER are assigned to
--          members of the AYURLAHI_TEAM organisation that runs the CRM.
--          See scope/Medilink_CRM_Final_Brief.md B1.
--
-- HOW TO APPLY
--   psql "$DATABASE_URL" -f src/migrations/2026-06-04-crm-sales-roles.sql
-- Idempotent: drops + recreates the CHECK with the full role set.
-- ============================================================================

BEGIN;

ALTER TABLE "public"."organisation_users"
  DROP CONSTRAINT IF EXISTS "organisation_users_role_check";

ALTER TABLE "public"."organisation_users"
  ADD CONSTRAINT "organisation_users_role_check"
  CHECK ((("role")::"text" = ANY ((ARRAY[
    'SUPER_ADMIN'::character varying,
    'SUPPORT'::character varying,
    'OWNER'::character varying,
    'MANAGER'::character varying,
    'STAFF'::character varying,
    'DOCTOR'::character varying,
    'ADMIN'::character varying,
    'NURSE'::character varying,
    'THERAPIST'::character varying,
    'PHARMACIST'::character varying,
    'RECEPTIONIST'::character varying,
    'LAB_TECHNICIAN'::character varying,
    'TELECALLER'::character varying,
    'FIELD_STAFF'::character varying,
    'TEAM_LEAD'::character varying,
    'SALES_MANAGER'::character varying,
    'PATIENT'::character varying
  ])::"text"[])));

INSERT INTO "public"."migrations" ("name")
VALUES ('2026-06-04-crm-sales-roles')
ON CONFLICT ("name") DO NOTHING;

COMMIT;
