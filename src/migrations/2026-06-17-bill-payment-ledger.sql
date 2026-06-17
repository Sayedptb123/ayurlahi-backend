-- ADR-003 Phase 1 — Payment Ledger.
--
-- Individual payment records against a patient bill. Today recordPayment only
-- bumps patient_bills.paid_amount (a running total) with no history; this table
-- IS the history ("₹20k on 10 Jun, ₹10k on 15 Jun …").
--
-- Named patient_bill_payments — NOT bill_payments — because bill_payments is
-- already taken by the unrelated recurring-bills feature.
--
-- SOURCE OF TRUTH for "how much is paid" is SUM(amount) over the non-deleted rows
-- here. patient_bills.paid_amount is a transactionally-maintained cache (ADR-003 D3).

CREATE TABLE IF NOT EXISTS patient_bill_payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisations(id),
  bill_id          uuid NOT NULL REFERENCES patient_bills(id),
  amount           decimal(12, 2) NOT NULL CHECK (amount > 0),
  paid_at          date NOT NULL DEFAULT now(),
  payment_method   varchar(20) NOT NULL,
  reference_no     varchar(100) NULL,
  notes            text NULL,
  created_by       uuid NULL REFERENCES users(id),
  created_at       timestamp NOT NULL DEFAULT now(),
  updated_at       timestamp NOT NULL DEFAULT now(),
  deleted_at       timestamp NULL
);

-- Hot path: list / SUM the live payments for one bill.
CREATE INDEX IF NOT EXISTS idx_bill_payments_bill
  ON patient_bill_payments (bill_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bill_payments_org
  ON patient_bill_payments (organisation_id);

COMMENT ON TABLE patient_bill_payments IS
  'Payment history (ledger) for patient_bills. SUM(amount WHERE deleted_at IS NULL) is the source of truth for paid amount; patient_bills.paid_amount is a cache. ADR-003 D2/D3.';
