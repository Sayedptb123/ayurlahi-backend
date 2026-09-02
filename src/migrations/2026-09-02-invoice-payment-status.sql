-- Adds real payment tracking to invoices. Previously "status" was faked
-- purely from dueDate (overdue if past due, else pending) — no invoice was
-- ever actually recorded as paid. Payment is recorded manually by a Team
-- Ayurlahi admin/support user (Ayurlahi mediates the transaction, so the
-- clinic/manufacturer self-reporting wouldn't be a trustworthy audit trail),
-- mirroring the existing bill_payments / patient_bill_payments pattern.
BEGIN;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "isPaid" boolean NOT NULL DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "paidAt" timestamp NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "paidAmount" numeric(12,2) NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "paymentNotes" text NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "paymentRecordedBy" uuid NULL REFERENCES users(id) ON DELETE SET NULL;

COMMIT;
