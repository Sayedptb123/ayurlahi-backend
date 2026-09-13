-- Post-PACKED Order Correction Workflow (scope/Post_PACKED_Correction_Workflow_Design_2026-09-13.md).
-- Adds a real, visible "cancelled" state to invoices, per the industry-standard
-- pattern both rounds of research converged on: keep the original invoice,
-- mark it cancelled, don't delete it, link to whatever replaces it.
--
-- Deliberately NOT using invoice.deletedAt for this -- that column already
-- means "excluded from every normal query," and a cancelled invoice should
-- stay visible/listable (filterable by status), just no longer counted as
-- outstanding/pending. Two different meanings, two different columns.
--
-- GST/e-invoice statutory treatment (scope/Post_PACKED_Correction_Workflow_Design_2026-09-13.md
-- §10) remains an open question with Ayurlahi's CA -- deliberately deferred per
-- explicit product decision (2026-09-13): PMS (the manufacturer) handles GST
-- compliance for now, so this migration implements the generic industry-standard
-- "cancel + linked replacement" pattern without waiting on the statutory answer.

BEGIN;

ALTER TABLE invoices ADD COLUMN "cancelledAt" timestamp;
ALTER TABLE invoices ADD COLUMN "cancelReason" varchar(255);

COMMIT;
