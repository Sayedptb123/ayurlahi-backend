-- ============================================================================
-- 2026-06-04-crm-sales-module
-- Purpose: Sales CRM module for the marketing team (telecallers + field staff)
--          to discover, contact, visit, track, and onboard Ayurvedic /
--          postnatal centres as Medilink customers.
--          See scope/Medilink_CRM_Final_Brief.md.
-- ============================================================================
--
-- OWNERSHIP & MULTI-TENANCY
-- -------------------------
-- The CRM belongs to the internal AYURLAHI_TEAM organisation. Every table below
-- carries `organisation_id -> organisations(id)` like every other table in the
-- schema (the #1 hard rule). The "leads" are PROSPECT centres, not tenant data;
-- when a lead is Onboarded (WON) it links to the newly-created CLINIC org via
-- `crm_leads.onboarded_organisation_id`.
--
-- Staff identity for accountability (assignments, activity authors, audit
-- actors) references `users(id)` directly. New sales roles (TELECALLER,
-- FIELD_STAFF, TEAM_LEAD, SALES_MANAGER) live in the application UserRole enum
-- and on organisation_users; no DB enum to alter here.
--
-- CONVENTIONS
-- -----------
--   * snake_case columns, British spelling (organisation), lowercase statuses
--   * soft delete via deleted_at (no hard deletes)
--   * never store app-computed values; check_in distance is a *captured
--     measurement* (recorded once at check-in), not a derived field, so it is
--     stored deliberately.
--
-- HOW TO APPLY
-- ------------
--   psql "$DATABASE_URL" -f src/migrations/2026-06-04-crm-sales-module.sql
-- Idempotent: safe to run multiple times. Connect as the table owner (postgres).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. crm_pipeline_stages — configurable pipeline (B2)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."crm_pipeline_stages" (
    "id"               "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id"  "uuid" NOT NULL,
    "key"              character varying(50) NOT NULL,
    "label"            character varying(100) NOT NULL,
    "sort_order"       integer NOT NULL DEFAULT 0,
    "is_won"           boolean NOT NULL DEFAULT false,
    "is_lost"          boolean NOT NULL DEFAULT false,
    "is_side_state"    boolean NOT NULL DEFAULT false,
    "is_active"        boolean NOT NULL DEFAULT true,
    "created_at"       timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_pipeline_stages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_pipeline_stages_org_fk"
        FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "crm_pipeline_stages_org_key_uq"
    ON "public"."crm_pipeline_stages" ("organisation_id", "key");

-- ----------------------------------------------------------------------------
-- 2. crm_leads — the prospect centre (B3 Lead/Centre)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."crm_leads" (
    "id"                        "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id"           "uuid" NOT NULL,
    "name"                      character varying(255) NOT NULL,
    -- ayurvedic_clinic | postnatal | hospital_wing
    "centre_type"               character varying(40),
    "bed_count"                 integer,
    "address"                   "text",
    "area"                      character varying(150),
    "city"                      character varying(150),
    "district"                  character varying(150),
    "state"                     character varying(150),
    "latitude"                  numeric(10,7),
    "longitude"                 numeric(10,7),
    -- primary contact
    "primary_contact_name"      character varying(150),
    "primary_contact_designation" character varying(100),
    "phone"                     character varying(30),
    "phone_secondary"           character varying(30),
    "whatsapp"                  character varying(30),
    "email"                     character varying(255),
    -- qualification
    "lead_source"               character varying(100),
    "owner_doctor_name"         character varying(150),
    "owner_doctor_is_bams"      boolean,
    -- paper | excel | whatsapp | competitor | none | other
    "current_software"          character varying(100),
    -- assignment (users.id for accountability)
    "assigned_telecaller_id"    "uuid",
    "assigned_field_staff_id"   "uuid",
    -- pipeline
    "stage"                     character varying(50) NOT NULL DEFAULT 'new',
    -- hot | warm | cold
    "priority"                  character varying(10) NOT NULL DEFAULT 'warm',
    "tags"                      "jsonb",
    "lost_reason"               "text",
    -- discovery / dedupe linkage (from the Google Maps scraper)
    "google_place_id"           character varying(255),
    "google_maps_url"           "text",
    "website"                   "text",
    "rating"                    numeric(2,1),
    "user_ratings_total"        integer,
    -- lifecycle flags / links (B8 edge cases)
    "is_incomplete"             boolean NOT NULL DEFAULT false,
    "duplicate_of_lead_id"      "uuid",
    "onboarded_organisation_id" "uuid",
    "last_contacted_at"         timestamp without time zone,
    "next_follow_up_at"         timestamp without time zone,
    -- audit
    "created_by"                "uuid",
    "updated_by"                "uuid",
    "created_at"                timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"                timestamp without time zone,
    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_leads_org_fk"
        FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE CASCADE,
    CONSTRAINT "crm_leads_telecaller_fk"
        FOREIGN KEY ("assigned_telecaller_id") REFERENCES "public"."users"("id") ON DELETE SET NULL,
    CONSTRAINT "crm_leads_field_staff_fk"
        FOREIGN KEY ("assigned_field_staff_id") REFERENCES "public"."users"("id") ON DELETE SET NULL,
    CONSTRAINT "crm_leads_duplicate_fk"
        FOREIGN KEY ("duplicate_of_lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE SET NULL,
    CONSTRAINT "crm_leads_onboarded_org_fk"
        FOREIGN KEY ("onboarded_organisation_id") REFERENCES "public"."organisations"("id") ON DELETE SET NULL,
    CONSTRAINT "crm_leads_centre_type_check"
        CHECK ("centre_type" IS NULL OR ("centre_type")::"text" = ANY (ARRAY['ayurvedic_clinic','postnatal','hospital_wing']::"text"[])),
    CONSTRAINT "crm_leads_priority_check"
        CHECK (("priority")::"text" = ANY (ARRAY['hot','warm','cold']::"text"[]))
);
-- per-org dedupe on the Google place id (partial: only when present)
CREATE UNIQUE INDEX IF NOT EXISTS "crm_leads_org_place_uq"
    ON "public"."crm_leads" ("organisation_id", "google_place_id")
    WHERE "google_place_id" IS NOT NULL AND "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "crm_leads_org_idx"            ON "public"."crm_leads" ("organisation_id");
CREATE INDEX IF NOT EXISTS "crm_leads_telecaller_idx"     ON "public"."crm_leads" ("assigned_telecaller_id");
CREATE INDEX IF NOT EXISTS "crm_leads_field_staff_idx"    ON "public"."crm_leads" ("assigned_field_staff_id");
CREATE INDEX IF NOT EXISTS "crm_leads_stage_idx"          ON "public"."crm_leads" ("stage");
CREATE INDEX IF NOT EXISTS "crm_leads_phone_idx"          ON "public"."crm_leads" ("phone");
CREATE INDEX IF NOT EXISTS "crm_leads_next_follow_up_idx" ON "public"."crm_leads" ("next_follow_up_at");

-- ----------------------------------------------------------------------------
-- 3. crm_activities — interaction timeline, one row per touch (B3 Activity)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."crm_activities" (
    "id"                "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id"   "uuid" NOT NULL,
    "lead_id"           "uuid" NOT NULL,
    -- call | whatsapp | visit | email | note
    "type"              character varying(20) NOT NULL,
    -- call dispositions (B4) or visit/other outcome
    "disposition"       character varying(60),
    "notes"             "text",
    -- the REAL moment the touch happened (offline: captured at touch, not sync)
    "occurred_at"       timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_seconds"  integer,
    -- staff identity (accountability)
    "staff_user_id"     "uuid" NOT NULL,
    -- geo for visit touches
    "latitude"          numeric(10,7),
    "longitude"         numeric(10,7),
    -- S3 keys
    "attachments"       "jsonb",
    "next_action"       "text",
    "next_action_due_at" timestamp without time zone,
    -- anti-fraud / sync metadata
    "call_log_verified" boolean NOT NULL DEFAULT false,
    "whatsapp_template" character varying(60),
    "created_offline"   boolean NOT NULL DEFAULT false,
    "synced_at"         timestamp without time zone,
    "created_at"        timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"        timestamp without time zone,
    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_activities_org_fk"
        FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE CASCADE,
    CONSTRAINT "crm_activities_lead_fk"
        FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE CASCADE,
    CONSTRAINT "crm_activities_staff_fk"
        FOREIGN KEY ("staff_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL,
    CONSTRAINT "crm_activities_type_check"
        CHECK (("type")::"text" = ANY (ARRAY['call','whatsapp','visit','email','note']::"text"[]))
);
CREATE INDEX IF NOT EXISTS "crm_activities_lead_idx"  ON "public"."crm_activities" ("lead_id");
CREATE INDEX IF NOT EXISTS "crm_activities_org_idx"   ON "public"."crm_activities" ("organisation_id");
CREATE INDEX IF NOT EXISTS "crm_activities_staff_idx" ON "public"."crm_activities" ("staff_user_id");
CREATE INDEX IF NOT EXISTS "crm_activities_when_idx"  ON "public"."crm_activities" ("occurred_at");

-- ----------------------------------------------------------------------------
-- 4. crm_requirements — structured requirement / feedback capture (B3)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."crm_requirements" (
    "id"                       "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id"          "uuid" NOT NULL,
    "lead_id"                  "uuid" NOT NULL,
    -- optional link to the touch where this was captured
    "activity_id"              "uuid",
    -- high | medium | low
    "interest_level"           character varying(10),
    "modules_wanted"           "jsonb",
    "pain_points"              "text",
    "objections"               "text",
    "bed_count"                integer,
    "patients_per_month"       integer,
    "decision_maker_name"      character varying(150),
    "spoke_to_decision_maker"  boolean,
    "decision_timeline"        character varying(100),
    "competitor"               character varying(150),
    "pricing_discussed"        "text",
    "pricing_reaction"         "text",
    "verbatim_feedback"        "text",
    "captured_by_user_id"      "uuid",
    "created_at"               timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at"               timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"               timestamp without time zone,
    CONSTRAINT "crm_requirements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_requirements_org_fk"
        FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE CASCADE,
    CONSTRAINT "crm_requirements_lead_fk"
        FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE CASCADE,
    CONSTRAINT "crm_requirements_activity_fk"
        FOREIGN KEY ("activity_id") REFERENCES "public"."crm_activities"("id") ON DELETE SET NULL,
    CONSTRAINT "crm_requirements_captured_by_fk"
        FOREIGN KEY ("captured_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL,
    CONSTRAINT "crm_requirements_interest_check"
        CHECK ("interest_level" IS NULL OR ("interest_level")::"text" = ANY (ARRAY['high','medium','low']::"text"[]))
);
CREATE INDEX IF NOT EXISTS "crm_requirements_lead_idx" ON "public"."crm_requirements" ("lead_id");
CREATE INDEX IF NOT EXISTS "crm_requirements_org_idx"  ON "public"."crm_requirements" ("organisation_id");

-- ----------------------------------------------------------------------------
-- 5. crm_tasks — follow-ups & reminders (B3 Task, B6)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."crm_tasks" (
    "id"               "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id"  "uuid" NOT NULL,
    "lead_id"          "uuid" NOT NULL,
    "assignee_user_id" "uuid" NOT NULL,
    "title"            character varying(255) NOT NULL,
    "description"      "text",
    -- call_back | visit | send_quote | nurture | other
    "task_type"        character varying(40),
    "due_at"           timestamp without time zone NOT NULL,
    "reminder_at"      timestamp without time zone,
    -- pending | done | overdue | cancelled
    "status"           character varying(20) NOT NULL DEFAULT 'pending',
    "is_recurring"     boolean NOT NULL DEFAULT false,
    "recurrence"       character varying(40),
    "escalated_at"     timestamp without time zone,
    "completed_at"     timestamp without time zone,
    "created_by"       "uuid",
    "created_at"       timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"       timestamp without time zone,
    CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_tasks_org_fk"
        FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE CASCADE,
    CONSTRAINT "crm_tasks_lead_fk"
        FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE CASCADE,
    CONSTRAINT "crm_tasks_assignee_fk"
        FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL,
    CONSTRAINT "crm_tasks_status_check"
        CHECK (("status")::"text" = ANY (ARRAY['pending','done','overdue','cancelled']::"text"[]))
);
CREATE INDEX IF NOT EXISTS "crm_tasks_lead_idx"     ON "public"."crm_tasks" ("lead_id");
CREATE INDEX IF NOT EXISTS "crm_tasks_org_idx"      ON "public"."crm_tasks" ("organisation_id");
CREATE INDEX IF NOT EXISTS "crm_tasks_assignee_idx" ON "public"."crm_tasks" ("assignee_user_id");
CREATE INDEX IF NOT EXISTS "crm_tasks_due_idx"      ON "public"."crm_tasks" ("due_at");
CREATE INDEX IF NOT EXISTS "crm_tasks_status_idx"   ON "public"."crm_tasks" ("status");

-- ----------------------------------------------------------------------------
-- 6. crm_visits — geo-tagged site visits (B3 Visit, B5)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."crm_visits" (
    "id"                        "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id"           "uuid" NOT NULL,
    "lead_id"                   "uuid" NOT NULL,
    "assigned_field_staff_id"   "uuid" NOT NULL,
    "scheduled_at"              timestamp without time zone,
    "check_in_at"               timestamp without time zone,
    "check_in_latitude"         numeric(10,7),
    "check_in_longitude"        numeric(10,7),
    "check_out_at"              timestamp without time zone,
    -- captured measurement at check-in (metres from registered centre location)
    "distance_from_registered_m" numeric(10,2),
    "location_mismatch"         boolean NOT NULL DEFAULT false,
    "outcome"                   "text",
    "demo_given"                boolean NOT NULL DEFAULT false,
    "met_person_name"           character varying(150),
    "materials_left"            "text",
    "photos"                    "jsonb",
    "consent_signature_url"     "text",
    -- offline sync metadata
    "created_offline"           boolean NOT NULL DEFAULT false,
    "synced_at"                 timestamp without time zone,
    "created_by"                "uuid",
    "created_at"                timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"                timestamp without time zone,
    CONSTRAINT "crm_visits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_visits_org_fk"
        FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE CASCADE,
    CONSTRAINT "crm_visits_lead_fk"
        FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE CASCADE,
    CONSTRAINT "crm_visits_field_staff_fk"
        FOREIGN KEY ("assigned_field_staff_id") REFERENCES "public"."users"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "crm_visits_lead_idx"        ON "public"."crm_visits" ("lead_id");
CREATE INDEX IF NOT EXISTS "crm_visits_org_idx"         ON "public"."crm_visits" ("organisation_id");
CREATE INDEX IF NOT EXISTS "crm_visits_field_staff_idx" ON "public"."crm_visits" ("assigned_field_staff_id");
CREATE INDEX IF NOT EXISTS "crm_visits_scheduled_idx"   ON "public"."crm_visits" ("scheduled_at");

-- ----------------------------------------------------------------------------
-- 7. crm_audit_log — immutable audit trail (B7)
-- No deleted_at / updated_at: append-only. Original values kept on edits.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."crm_audit_log" (
    "id"             "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id" "uuid" NOT NULL,
    -- lead | activity | requirement | task | visit | assignment | stage
    "entity_type"    character varying(40) NOT NULL,
    "entity_id"      "uuid" NOT NULL,
    -- create | update | delete | stage_change | assignment | export
    "action"         character varying(40) NOT NULL,
    "actor_user_id"  "uuid",
    "changes"        "jsonb",
    "from_stage"     character varying(50),
    "to_stage"       character varying(50),
    "created_at"     timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_audit_log_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_audit_log_org_fk"
        FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE CASCADE,
    CONSTRAINT "crm_audit_log_actor_fk"
        FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "crm_audit_log_org_idx"    ON "public"."crm_audit_log" ("organisation_id");
CREATE INDEX IF NOT EXISTS "crm_audit_log_entity_idx" ON "public"."crm_audit_log" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "crm_audit_log_actor_idx"  ON "public"."crm_audit_log" ("actor_user_id");

-- ----------------------------------------------------------------------------
-- 8. Seed default pipeline stages for every AYURLAHI_TEAM org (B2)
--    Idempotent via the (organisation_id, key) unique index.
-- ----------------------------------------------------------------------------
INSERT INTO "public"."crm_pipeline_stages"
    ("organisation_id", "key", "label", "sort_order", "is_won", "is_lost", "is_side_state")
SELECT o."id", s."key", s."label", s."sort_order", s."is_won", s."is_lost", s."is_side_state"
FROM "public"."organisations" o
CROSS JOIN (VALUES
    ('new',            'New',             1, false, false, false),
    ('attempted',      'Attempted',       2, false, false, false),
    ('contacted',      'Contacted',       3, false, false, false),
    ('interested',     'Interested',      4, false, false, false),
    ('demo_scheduled', 'Demo Scheduled',  5, false, false, false),
    ('demo_done',      'Demo Done',       6, false, false, false),
    ('negotiation',    'Negotiation',     7, false, false, false),
    ('onboarded',      'Onboarded (WON)', 8, true,  false, false),
    ('lost',           'Lost',            9, false, true,  true),
    ('on_hold',        'On Hold / Nurture',10,false, false, true)
) AS s("key", "label", "sort_order", "is_won", "is_lost", "is_side_state")
WHERE o."type" = 'AYURLAHI_TEAM'
ON CONFLICT ("organisation_id", "key") DO NOTHING;

-- ----------------------------------------------------------------------------
-- 9. Enable RLS (deny-all) on the new tables, consistent with
--    2026-06-02-enable-rls-public.sql. Owner role (postgres) bypasses; the
--    NestJS backend is unaffected. Zero policies = PostgREST denied.
-- ----------------------------------------------------------------------------
ALTER TABLE "public"."crm_pipeline_stages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."crm_leads"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."crm_activities"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."crm_requirements"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."crm_tasks"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."crm_visits"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."crm_audit_log"       ENABLE ROW LEVEL SECURITY;

INSERT INTO "public"."migrations" ("name")
VALUES ('2026-06-04-crm-sales-module')
ON CONFLICT ("name") DO NOTHING;

COMMIT;
