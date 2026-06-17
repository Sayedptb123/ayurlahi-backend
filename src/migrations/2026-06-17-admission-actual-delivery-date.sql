-- Actual Delivery Date workflow (ADR-002 D10, corrected to admissions per W1-A).
--
-- The actual delivery date is the third postnatal date (after EDD on
-- booking_enquiries and preferred check-in on room_bookings). It lives on
-- `admissions` — NOT room_bookings — because it is a property of the mother's
-- episode of care, and walk-in mothers have an admission but no booking.
--
-- DATE (not timestamp): only the calendar day of birth matters; no time-of-day.
-- Nullable: not all admissions are postnatal, and the date may be unknown at
-- check-in (recorded later via "Mark Delivery Occurred").

ALTER TABLE admissions
  ADD COLUMN IF NOT EXISTS actual_delivery_date DATE NULL;

COMMENT ON COLUMN admissions.actual_delivery_date IS
  'Calendar date the baby was actually born. Postnatal only; set at check-in if known, else later via the Mark Delivery action. See ADR-002 D10.';
