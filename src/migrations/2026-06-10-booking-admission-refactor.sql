-- ============================================================================
-- 2026-06-10-booking-admission-refactor
-- Purpose: Complete the booking/admission architecture:
--   - admissions gets booking_id (nullable FK to room_bookings)
--   - room_bookings drops unused admission_id
--   - room_bookings gets enquiry_id (nullable FK to booking_enquiries)
--   - room_bookings.patient_id becomes nullable (enquiry-only HELD bookings)
--   - Status renames + backfill (room_bookings + admissions)
--   - Identity CHECK constraint (patient_id OR enquiry_id)
--
-- Prerequisites: 2026-06-10-booking-enquiries.sql must already be applied.
-- Idempotent where possible. Run scripts/backup-db.sh first.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. admissions.booking_id
-- ============================================================================
ALTER TABLE "public"."admissions"
    ADD COLUMN IF NOT EXISTS "booking_id" UUID REFERENCES "public"."room_bookings"("id");

CREATE INDEX IF NOT EXISTS "idx_admissions_booking_id"
    ON "public"."admissions" ("booking_id");

-- ============================================================================
-- 2. Status backfill — drop old CHECK first so updates don't violate it
-- ============================================================================
ALTER TABLE "public"."room_bookings"
    DROP CONSTRAINT IF EXISTS "room_bookings_status_check";

-- room_bookings backfill
UPDATE "public"."room_bookings"
    SET "status" = 'HELD'
    WHERE "status" = 'PENDING';

UPDATE "public"."room_bookings"
    SET "status" = 'FULFILLED'
    WHERE "status" IN ('CHECKED_IN', 'COMPLETED');

-- admissions backfill
UPDATE "public"."admissions"
    SET "status" = 'ACTIVE'
    WHERE "status" = 'PLANNED';

-- ============================================================================
-- 3. New status CHECK on room_bookings
-- ============================================================================
ALTER TABLE "public"."room_bookings"
    ADD CONSTRAINT "room_bookings_status_check"
    CHECK (("status")::"text" = ANY (ARRAY['HELD'::character varying, 'CONFIRMED'::character varying, 'FULFILLED'::character varying, 'CANCELLED'::character varying, 'NO_SHOW'::character varying]));

-- ============================================================================
-- 4. room_bookings schema reshape
-- ============================================================================
-- Drop unused admission_id
ALTER TABLE "public"."room_bookings"
    DROP COLUMN IF EXISTS "admission_id";

-- Make patient_id nullable (enquiry-only HELD bookings)
ALTER TABLE "public"."room_bookings"
    ALTER COLUMN "patient_id" DROP NOT NULL;

-- Add enquiry_id
ALTER TABLE "public"."room_bookings"
    ADD COLUMN IF NOT EXISTS "enquiry_id" UUID REFERENCES "public"."booking_enquiries"("id");

CREATE INDEX IF NOT EXISTS "idx_room_bookings_enquiry_id"
    ON "public"."room_bookings" ("enquiry_id");

-- Identity CHECK: every booking must link to either a patient or an enquiry
ALTER TABLE "public"."room_bookings"
    ADD CONSTRAINT "chk_booking_identity"
    CHECK ("patient_id" IS NOT NULL OR "enquiry_id" IS NOT NULL);

COMMIT;
