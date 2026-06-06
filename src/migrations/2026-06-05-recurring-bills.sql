-- ============================================================================
-- 2026-06-05-recurring-bills
-- Purpose: Create tables for recurring bills and bill payments
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."recurring_bills" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organisation_id" UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  "branch_id" UUID REFERENCES branches(id),
  "category" VARCHAR(100) NOT NULL,
  "bill_name" VARCHAR(255) NOT NULL,
  "bill_type" VARCHAR(50) NOT NULL,
  "vendor_name" VARCHAR(255) NOT NULL,
  "vendor_account_number" VARCHAR(100),
  "vendor_contact" VARCHAR(255),
  "estimated_amount" DECIMAL(12,2),
  "frequency" VARCHAR(20) NOT NULL CHECK (frequency IN ('daily','weekly','monthly','quarterly','yearly','custom')),
  "day_of_month" INT,
  "day_of_week" INT,
  "custom_pattern" JSONB,
  "auto_create_expense" BOOLEAN DEFAULT false,
  "auto_approve" BOOLEAN DEFAULT false,
  "approval_threshold" DECIMAL(12,2),
  "auto_pay" BOOLEAN DEFAULT false,
  "payment_method" VARCHAR(50),
  "is_active" BOOLEAN DEFAULT true,
  "next_due_date" DATE NOT NULL,
  "notes" TEXT,
  "created_by" UUID REFERENCES users(id),
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "public"."bill_payments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "recurring_bill_id" UUID NOT NULL REFERENCES recurring_bills(id) ON DELETE CASCADE,
  "bill_period_start" DATE,
  "bill_period_end" DATE,
  "bill_amount" DECIMAL(12,2) NOT NULL,
  "bill_number" VARCHAR(100),
  "bill_date" DATE,
  "due_date" DATE,
  "bill_url" TEXT,
  "paid_amount" DECIMAL(12,2) NOT NULL,
  "paid_date" DATE NOT NULL,
  "is_late" BOOLEAN DEFAULT false,
  "late_fee" DECIMAL(12,2) DEFAULT 0,
  "expense_id" UUID REFERENCES expenses(id) ON DELETE SET NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recurring_bills_org ON recurring_bills(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_bills_due ON recurring_bills(next_due_date) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bill_payments_bill ON bill_payments(recurring_bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_expense ON bill_payments(expense_id);

INSERT INTO "public"."migrations" ("name")
VALUES ('2026-06-05-recurring-bills')
ON CONFLICT ("name") DO NOTHING;

COMMIT;
