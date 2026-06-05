-- ============================================================================
-- 2026-06-05-crm-staff-scopes
-- Purpose: Per-staff data scoping for the Sales CRM. Lets an owner/manager
--          restrict which leads a CRM staff member can see by any combination
--          of state / district / stage / centre type / priority. Empty (or
--          absent) array on a dimension means "no restriction" there.
--          Enforced server-side ON TOP of the existing role isolation
--          (frontline still limited to their assigned leads).
--          See scope/Medilink_CRM_Final_Brief.md B1.
--
-- HOW TO APPLY
--   psql "$DATABASE_URL" -f src/migrations/2026-06-05-crm-staff-scopes.sql
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."crm_staff_scopes" (
    "id"               "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id"  "uuid" NOT NULL,
    "user_id"          "uuid" NOT NULL,
    "states"           "jsonb",
    "districts"        "jsonb",
    "stages"           "jsonb",
    "centre_types"     "jsonb",
    "priorities"       "jsonb",
    "created_by"       "uuid",
    "updated_by"       "uuid",
    "created_at"       timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_staff_scopes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_staff_scopes_org_fk"
        FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE CASCADE,
    CONSTRAINT "crm_staff_scopes_user_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_staff_scopes_org_user_uq"
    ON "public"."crm_staff_scopes" ("organisation_id", "user_id");

ALTER TABLE "public"."crm_staff_scopes" ENABLE ROW LEVEL SECURITY;

INSERT INTO "public"."migrations" ("name")
VALUES ('2026-06-05-crm-staff-scopes')
ON CONFLICT ("name") DO NOTHING;

COMMIT;
