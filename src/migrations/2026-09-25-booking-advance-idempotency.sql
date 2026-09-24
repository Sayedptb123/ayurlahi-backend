-- Cash MVP batch 1 (booking advances): a double-submitted "Record advance"
-- must not create two receipt rows. The key comes from the app, one per form
-- submit; the receipt row is the voucher's source, so it must be unique first.
-- received_into_account_id becomes nullable: before an organisation goes live
-- there are no ledgers yet, and "received into" is required only once live
-- (enforced in BookingAdvancePostingService, same rule as patient payments).
-- The table is empty on staging when this is written.
--
-- Rollback: DROP INDEX IF EXISTS uq_booking_advance_receipts_idem;
--           ALTER TABLE booking_advance_receipts DROP COLUMN IF EXISTS idempotency_key;
--           ALTER TABLE booking_advance_receipts ALTER COLUMN received_into_account_id SET NOT NULL;

BEGIN;

ALTER TABLE booking_advance_receipts ADD COLUMN idempotency_key UUID NULL;
ALTER TABLE booking_advance_receipts ALTER COLUMN received_into_account_id DROP NOT NULL;
CREATE UNIQUE INDEX uq_booking_advance_receipts_idem
  ON booking_advance_receipts (booking_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMIT;
