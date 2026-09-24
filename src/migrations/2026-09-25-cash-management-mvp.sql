-- ============================================================================
-- 2026-09-25-cash-management-mvp
-- Cash MVP foundation: chart of accounts, partners, vouchers + lines, gap-free
-- numbering, day close, booking-advance receipts, custody/expense columns.
--
-- Design + review: scope/Cash_Management_MVP_Implementation_Plan_2026-09-24.md
--                  scope/Cash_MVP_Schema_Review_2026-09-24.md (approved 2026-09-24,
--                  decisions 1-4). This file is generated from that doc's DDL and
--                  trigger blocks; change the doc first, then regenerate.
--
-- Additive only: new tables, nullable columns, two unique indexes on existing
-- (id, organisation_id) pairs. Nothing posts until an organisation sets
-- organisation_settings.cash_module_live_from (module-off switch).
--
-- The database enforces: balanced vouchers (deferred trigger), immutable
-- vouchers/lines (trigger), no posting into a closed day (trigger, one
-- exception: a close's own variance voucher), one live posting per source
-- event, one reversal per voucher, organisation isolation (composite FKs).
--
-- ROLLBACK (only while no organisation has gone live):
--   BEGIN;
--   DROP TRIGGER IF EXISTS voucher_lines_day_open ON voucher_lines;
--   DROP TRIGGER IF EXISTS vouchers_balanced ON vouchers;
--   DROP TRIGGER IF EXISTS voucher_lines_immutable ON voucher_lines;
--   DROP TRIGGER IF EXISTS vouchers_immutable ON vouchers;
--   DROP FUNCTION IF EXISTS cash_check_day_open(), cash_check_balanced(), cash_forbid_change();
--   ALTER TABLE expenses DROP COLUMN IF EXISTS reimbursement_voucher_id, DROP COLUMN IF EXISTS posted_via,
--     DROP COLUMN IF EXISTS no_bill_declaration, DROP COLUMN IF EXISTS vendor_name,
--     DROP COLUMN IF EXISTS paid_by_partner_id, DROP COLUMN IF EXISTS paid_by_user_id,
--     DROP COLUMN IF EXISTS paid_from_account_id, DROP COLUMN IF EXISTS paid_by_kind,
--     DROP COLUMN IF EXISTS account_id, DROP COLUMN IF EXISTS branch_id;
--   ALTER TABLE patient_bill_payments DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS received_into_account_id;
--   DROP TABLE IF EXISTS booking_advance_receipts, day_closes, voucher_counters, voucher_lines, vouchers, accounts, partners;
--   ALTER TABLE organisation_settings DROP COLUMN IF EXISTS cash_module_live_from;
--   DROP INDEX IF EXISTS uq_room_bookings_id_org, uq_branches_id_org;
--   COMMIT;
-- ============================================================================

BEGIN;

-- ── prerequisites on existing tables ────────────────────────────────────────
-- Composite-FK targets (C8). Additive; (id) is already unique, so these can't fail.
CREATE UNIQUE INDEX IF NOT EXISTS uq_branches_id_org     ON branches (id, organisation_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_room_bookings_id_org ON room_bookings (id, organisation_id);

ALTER TABLE organisation_settings
  ADD COLUMN cash_module_live_from DATE NULL;   -- NULL = module off (plan §7)

-- ── partners ─────────────────────────────────────────────────────────────────
CREATE TABLE partners (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  name            VARCHAR(150) NOT NULL,
  user_id         UUID NULL REFERENCES users(id),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ NULL,
  UNIQUE (id, organisation_id)
);
CREATE UNIQUE INDEX uq_partners_org_name ON partners (organisation_id, lower(name)) WHERE deleted_at IS NULL;

-- ── accounts (chart of accounts, plan §4) ────────────────────────────────────
CREATE TABLE accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   UUID NOT NULL REFERENCES organisations(id),
  branch_id         UUID NULL,
  kind              VARCHAR(30) NOT NULL CHECK (kind IN (
                      'cash','bank','upi','held_by_partner','partner_unclassified',
                      'staff_payable','income','patient_advances','expense',
                      'cash_variance','opening_balance')),
  name              VARCHAR(150) NOT NULL,
  system_key        VARCHAR(50) NULL,     -- seeded accounts found by key, never by name
  partner_id        UUID NULL,
  staff_user_id     UUID NULL REFERENCES users(id),
  custodian_user_id UUID NULL REFERENCES users(id),
  is_active         BOOLEAN NOT NULL DEFAULT true,  -- deactivate, never delete (lines reference it)
  created_by        UUID NULL REFERENCES users(id), -- NULL for seeded accounts
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id),
  FOREIGN KEY (branch_id, organisation_id)  REFERENCES branches (id, organisation_id),
  FOREIGN KEY (partner_id, organisation_id) REFERENCES partners (id, organisation_id),
  CHECK ((kind IN ('held_by_partner','partner_unclassified')) = (partner_id IS NOT NULL)),
  CHECK ((kind = 'staff_payable') = (staff_user_id IS NOT NULL))
);
CREATE UNIQUE INDEX uq_accounts_org_name    ON accounts (organisation_id, lower(name));
CREATE UNIQUE INDEX uq_accounts_system_key  ON accounts (organisation_id, system_key) WHERE system_key IS NOT NULL;
CREATE UNIQUE INDEX uq_accounts_partner     ON accounts (organisation_id, kind, partner_id) WHERE partner_id IS NOT NULL;
CREATE UNIQUE INDEX uq_accounts_staff       ON accounts (organisation_id, staff_user_id) WHERE staff_user_id IS NOT NULL;

-- ── vouchers ─────────────────────────────────────────────────────────────────
CREATE TABLE vouchers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id     UUID NOT NULL REFERENCES organisations(id),
  branch_id           UUID NULL,
  voucher_type        VARCHAR(10) NOT NULL CHECK (voucher_type IN ('receipt','payment','contra','journal')),
  voucher_number      INTEGER NOT NULL CHECK (voucher_number > 0),
  voucher_date        DATE NOT NULL,     -- business date (G9), never a UTC date
  fy_start_year       SMALLINT GENERATED ALWAYS AS (
                        (EXTRACT(YEAR FROM voucher_date)
                         - CASE WHEN EXTRACT(MONTH FROM voucher_date) >= 4 THEN 0 ELSE 1 END)::smallint
                      ) STORED,          -- Indian FY April–March (C3)
  original_date       DATE NULL,         -- late entry: the day it really happened (plan D11)
  narration           TEXT NOT NULL,
  source_type         VARCHAR(30) NOT NULL CHECK (source_type IN (
                        'patient_payment','booking_advance','advance_transfer','booking_refund',
                        'bill_payment','asset_maintenance','expense','reimbursement',
                        'money_in','transfer','day_close','opening','reversal')),
  source_id           UUID NULL,
  idempotency_key     UUID NULL,
  reversal_of         UUID NULL UNIQUE,  -- at most one reversal per voucher (C4)
  reversal_reason     TEXT NULL,
  evidence_url        VARCHAR(500) NULL,
  no_bill_declaration JSONB NULL,
  created_by          UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id),
  CONSTRAINT uq_vouchers_number UNIQUE (organisation_id, voucher_type, fy_start_year, voucher_number),
  FOREIGN KEY (branch_id, organisation_id)   REFERENCES branches (id, organisation_id),
  FOREIGN KEY (reversal_of, organisation_id) REFERENCES vouchers (id, organisation_id),
  CHECK ((source_type = 'reversal') = (reversal_of IS NOT NULL)),
  CHECK (reversal_of IS NULL OR reversal_reason IS NOT NULL),
  CHECK (original_date IS NULL OR original_date < voucher_date)
);
-- Idempotency: one posting per source event, one per client submit (C7).
CREATE UNIQUE INDEX uq_vouchers_source ON vouchers (organisation_id, source_type, source_id) WHERE source_id IS NOT NULL;
CREATE UNIQUE INDEX uq_vouchers_idem   ON vouchers (organisation_id, idempotency_key)      WHERE idempotency_key IS NOT NULL;
CREATE INDEX ix_vouchers_org_date      ON vouchers (organisation_id, voucher_date);

-- ── voucher_lines ────────────────────────────────────────────────────────────
CREATE TABLE voucher_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id      UUID NOT NULL,
  organisation_id UUID NOT NULL,
  line_no         SMALLINT NOT NULL,
  account_id      UUID NOT NULL,
  branch_id       UUID NULL,             -- NULL = organisation-wide / shared (ADR-004 D9)
  debit           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (debit  >= 0),
  credit          NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description     TEXT NULL,
  UNIQUE (voucher_id, line_no),
  FOREIGN KEY (voucher_id, organisation_id) REFERENCES vouchers (id, organisation_id),
  FOREIGN KEY (account_id, organisation_id) REFERENCES accounts (id, organisation_id),
  FOREIGN KEY (branch_id,  organisation_id) REFERENCES branches (id, organisation_id),
  CHECK ((debit > 0) <> (credit > 0))   -- exactly one side
);
CREATE INDEX ix_lines_account ON voucher_lines (account_id);
CREATE INDEX ix_lines_voucher ON voucher_lines (voucher_id);

-- ── gap-free numbering ───────────────────────────────────────────────────────
CREATE TABLE voucher_counters (
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  voucher_type    VARCHAR(10) NOT NULL,
  fy_start_year   SMALLINT NOT NULL,
  last_number     INTEGER NOT NULL,
  PRIMARY KEY (organisation_id, voucher_type, fy_start_year)
);

-- ── day close ────────────────────────────────────────────────────────────────
CREATE TABLE day_closes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id     UUID NOT NULL,
  account_id          UUID NOT NULL,
  close_date          DATE NOT NULL,
  expected_amount     NUMERIC(12,2) NOT NULL,  -- snapshot at close: an attestation, not a cache (plan D9)
  counted_amount      NUMERIC(12,2) NOT NULL CHECK (counted_amount >= 0),
  denominations       JSONB NULL,
  reason              TEXT NULL,
  status              VARCHAR(10) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','rejected')),
  counted_by          UUID NOT NULL REFERENCES users(id),
  counted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by         UUID NULL REFERENCES users(id),
  reviewed_at         TIMESTAMPTZ NULL,
  variance_voucher_id UUID NULL,
  FOREIGN KEY (account_id, organisation_id)          REFERENCES accounts (id, organisation_id),
  FOREIGN KEY (variance_voucher_id, organisation_id) REFERENCES vouchers (id, organisation_id),
  CHECK (reviewed_by IS NULL OR reviewed_by <> counted_by),               -- counter ≠ approver
  CHECK (counted_amount = expected_amount OR reason IS NOT NULL)           -- variance needs a reason
);
-- One live close per account per day; a rejected close can be redone.
CREATE UNIQUE INDEX uq_day_close ON day_closes (account_id, close_date) WHERE status <> 'rejected';

-- ── booking advances as real receipts (G3) ───────────────────────────────────
CREATE TABLE booking_advance_receipts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id          UUID NOT NULL,
  booking_id               UUID NOT NULL,
  amount                   NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  received_at              DATE NOT NULL,
  payment_method           VARCHAR(20) NOT NULL,
  reference_no             VARCHAR(100) NULL,
  received_into_account_id UUID NOT NULL,
  notes                    TEXT NULL,
  created_by               UUID NOT NULL REFERENCES users(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at               TIMESTAMPTZ NULL,   -- void = soft delete + reversal voucher
  FOREIGN KEY (booking_id, organisation_id)               REFERENCES room_bookings (id, organisation_id),
  FOREIGN KEY (received_into_account_id, organisation_id) REFERENCES accounts (id, organisation_id)
);
CREATE INDEX ix_advance_receipts_booking ON booking_advance_receipts (booking_id) WHERE deleted_at IS NULL;

-- ── existing tables: custody and expense fields ──────────────────────────────
ALTER TABLE patient_bill_payments
  ADD COLUMN received_into_account_id UUID NULL,     -- required by the service once live (C2)
  ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'counter'
    CHECK (source IN ('counter','booking_advance')),
  ADD FOREIGN KEY (received_into_account_id, organisation_id) REFERENCES accounts (id, organisation_id);

ALTER TABLE expenses
  ADD COLUMN branch_id               UUID NULL,
  ADD COLUMN account_id              UUID NULL,      -- expense head; NULL on pre-module rows
  ADD COLUMN paid_by_kind            VARCHAR(20) NULL CHECK (paid_by_kind IN ('hospital_account','staff','partner')),
  ADD COLUMN paid_from_account_id    UUID NULL,
  ADD COLUMN paid_by_user_id         UUID NULL REFERENCES users(id),
  ADD COLUMN paid_by_partner_id      UUID NULL,
  ADD COLUMN vendor_name             VARCHAR(150) NULL,
  ADD COLUMN no_bill_declaration     JSONB NULL,
  ADD COLUMN posted_via              VARCHAR(20) NULL CHECK (posted_via IN ('bill_payment','asset_maintenance')),
  ADD COLUMN reimbursement_voucher_id UUID NULL,
  ADD FOREIGN KEY (branch_id, organisation_id)                REFERENCES branches (id, organisation_id),
  ADD FOREIGN KEY (account_id, organisation_id)               REFERENCES accounts (id, organisation_id),
  ADD FOREIGN KEY (paid_from_account_id, organisation_id)     REFERENCES accounts (id, organisation_id),
  ADD FOREIGN KEY (paid_by_partner_id, organisation_id)       REFERENCES partners (id, organisation_id),
  ADD FOREIGN KEY (reimbursement_voucher_id, organisation_id) REFERENCES vouchers (id, organisation_id),
  ADD CHECK (paid_by_kind IS NULL
          OR (paid_by_kind = 'hospital_account' AND paid_from_account_id IS NOT NULL AND paid_by_user_id IS NULL AND paid_by_partner_id IS NULL)
          OR (paid_by_kind = 'staff'   AND paid_by_user_id    IS NOT NULL AND paid_from_account_id IS NULL AND paid_by_partner_id IS NULL)
          OR (paid_by_kind = 'partner' AND paid_by_partner_id IS NOT NULL AND paid_from_account_id IS NULL AND paid_by_user_id IS NULL));

-- ── RLS, same as every other public table (C11) ──────────────────────────────
ALTER TABLE partners                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_lines            ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_counters         ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_closes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_advance_receipts ENABLE ROW LEVEL SECURITY;

-- ── triggers (review §5) ─────────────────────────────────────────────────────
-- 1. Immutability: posted money records are never edited or deleted.
CREATE FUNCTION cash_forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are immutable; post a reversal instead', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END $$;
CREATE TRIGGER vouchers_immutable      BEFORE UPDATE OR DELETE ON vouchers      FOR EACH ROW EXECUTE FUNCTION cash_forbid_change();
CREATE TRIGGER voucher_lines_immutable BEFORE UPDATE OR DELETE ON voucher_lines FOR EACH ROW EXECUTE FUNCTION cash_forbid_change();

-- 2. Balance: checked at COMMIT, after all lines are in.
CREATE FUNCTION cash_check_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d NUMERIC; c NUMERIC; n INT;
BEGIN
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0), COUNT(*) INTO d, c, n
    FROM voucher_lines WHERE voucher_id = NEW.id;
  IF n < 2 OR d <> c OR d = 0 THEN
    RAISE EXCEPTION 'voucher % is unbalanced (debit %, credit %, % lines)', NEW.id, d, c, n
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER vouchers_balanced AFTER INSERT ON vouchers
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cash_check_balanced();

-- 3. Day lock: no line may land on or before a closed day of its account.
CREATE FUNCTION cash_check_day_open() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v RECORD;
BEGIN
  SELECT voucher_date, source_type, source_id INTO v FROM vouchers WHERE id = NEW.voucher_id;
  IF EXISTS (SELECT 1 FROM day_closes dc
              WHERE dc.account_id = NEW.account_id AND dc.close_date >= v.voucher_date
                AND dc.status <> 'rejected'
                -- the one exception: a close's own variance voucher, dated on its day
                AND NOT (v.source_type = 'day_close' AND v.source_id = dc.id)) THEN
    RAISE EXCEPTION 'day % is closed for this account; post on today''s date with original_date', v.voucher_date
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER voucher_lines_day_open BEFORE INSERT ON voucher_lines
  FOR EACH ROW EXECUTE FUNCTION cash_check_day_open();

COMMIT;
