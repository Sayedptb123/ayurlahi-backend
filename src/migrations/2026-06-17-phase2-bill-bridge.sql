-- ADR-003 Phase 2: Booking ↔ Bill Bridge
-- Links patient_bills back to postnatal bookings and admissions.
-- Applied: 2026-06-17

ALTER TABLE patient_bills
  ADD COLUMN IF NOT EXISTS booking_id  uuid NULL REFERENCES room_bookings(id),
  ADD COLUMN IF NOT EXISTS admission_id uuid NULL REFERENCES admissions(id);

CREATE INDEX IF NOT EXISTS idx_patient_bills_booking   ON patient_bills (booking_id)   WHERE booking_id   IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patient_bills_admission ON patient_bills (admission_id) WHERE admission_id IS NOT NULL;

COMMENT ON COLUMN patient_bills.booking_id  IS 'Nullable FK to room_bookings. Set when bill is auto-created at admission for a confirmed booking.';
COMMENT ON COLUMN patient_bills.admission_id IS 'Nullable FK to admissions. Set when bill is auto-created at check-in. Source of truth for postnatal stay billing.';
