-- ============================================================================
-- 2026-06-10-booking-enquiries
-- Purpose: Create the booking_enquiries table — the canonical contact-identity
--          store for pre-patient people. Separate from B2B crm_leads.
--          Idempotent, safe to re-run.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."booking_enquiries" (
    "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organisation_id"   UUID NOT NULL REFERENCES "public"."organisations"("id") ON DELETE CASCADE,
    "contact_name"      VARCHAR(255) NOT NULL,
    "phone"             VARCHAR(50) NOT NULL,
    "channel"           VARCHAR(50) NOT NULL CHECK (channel IN ('PHONE', 'WALK_IN', 'WHATSAPP', 'WEBSITE')),
    "preferred_room_type" VARCHAR(50),
    "preferred_check_in"  DATE,
    "preferred_check_out" DATE,
    "status"            VARCHAR(50) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'FOLLOW_UP', 'LOST')),
    "notes"             TEXT,
    "assigned_to"       UUID REFERENCES "public"."users"("id"),
    "follow_up_at"      TIMESTAMP,
    "lost_reason"       TEXT,
    "created_at"        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"        TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_booking_enquiries_org"
    ON "public"."booking_enquiries" ("organisation_id")
    WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_booking_enquiries_phone"
    ON "public"."booking_enquiries" ("phone")
    WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_booking_enquiries_status"
    ON "public"."booking_enquiries" ("status")
    WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_booking_enquiries_follow_up"
    ON "public"."booking_enquiries" ("follow_up_at")
    WHERE "status" IN ('NEW', 'FOLLOW_UP') AND "deleted_at" IS NULL;

COMMIT;
