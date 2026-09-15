-- Booking cancellation/refund dead-end fix (scope/Handoff_Blocker_Fixes_2026-09-16.md #1).
-- Cancelling a booking with advance_paid > 0 previously had no way to clear
-- that deposit -- no refund feature existed anywhere, and removeBooking()
-- unconditionally blocked deletion whenever advance_paid > 0.
--
-- advance_paid is left untouched by this migration and by the new refund
-- endpoint -- it's a historical snapshot of what the customer actually paid
-- (same convention as invoices.discountAmount elsewhere in this codebase:
-- financial snapshots don't get mutated after the fact). What was actually
-- returned is recorded separately in refund_amount, so both facts stay
-- independently visible.
--
-- Product decision (2026-09-16): exactly ONE refund record per booking, not a
-- ledger of installments -- refund_amount can be less than advance_paid (a
-- partial refund is just a smaller one-time number, not multiple entries).
-- refunded_at IS NOT NULL is the single source of truth for "has a refund
-- been recorded" -- removeBooking()'s guard is updated in the same change to
-- check this instead of advance_paid alone.
--
-- refund_method is a plain varchar+CHECK, not a native Postgres enum -- same
-- pattern already used for booking_enquiries.channel/status (see
-- 2026-06-10-booking-enquiries.sql). refunded_by is a plain uuid column with
-- no REFERENCES, matching the existing cancelled_by/organisation_id
-- plain-FK-by-convention style used throughout this codebase.
--
-- All five columns are nullable with no default -- backward-compatible with
-- every existing room_bookings row (reads as "no refund recorded").

BEGIN;

ALTER TABLE room_bookings ADD COLUMN refund_amount DECIMAL(10, 2);
ALTER TABLE room_bookings ADD COLUMN refund_method VARCHAR(20)
    CHECK (refund_method IN ('CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER'));
ALTER TABLE room_bookings ADD COLUMN refund_note TEXT;
ALTER TABLE room_bookings ADD COLUMN refunded_by UUID;
ALTER TABLE room_bookings ADD COLUMN refunded_at TIMESTAMP;

COMMIT;
