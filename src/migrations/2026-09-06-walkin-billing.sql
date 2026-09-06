-- Walk-in / patient-optional billing. patient_bills.patient_id was NOT NULL,
-- forcing every sale (including a walk-in buying a single product with no
-- clinical relationship to the clinic) to be tied to a patient record.
-- patient_id IS NULL now means "walk-in bill" — no separate billing_type
-- column, no walk_in_sales table. See scope/Walkin_Billing_Scope_2026-09-06.md.
BEGIN;

ALTER TABLE patient_bills ALTER COLUMN patient_id DROP NOT NULL;
ALTER TABLE patient_bills ADD COLUMN IF NOT EXISTS walk_in_name varchar(200) NULL;
ALTER TABLE patient_bills ADD COLUMN IF NOT EXISTS walk_in_phone varchar(20) NULL;

COMMIT;
