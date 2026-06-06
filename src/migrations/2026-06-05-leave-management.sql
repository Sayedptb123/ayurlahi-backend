-- ============================================================================
-- 2026-06-05-leave-management
-- Purpose: Create tables for leave types, leave requests, and leave balances
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."leave_types" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organisation_id" UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  "name" VARCHAR(100) NOT NULL,
  "code" VARCHAR(50),
  "max_days_per_year" INT,
  "is_paid" BOOLEAN DEFAULT true,
  "requires_approval" BOOLEAN DEFAULT true,
  "carry_forward" BOOLEAN DEFAULT false,
  "max_carry_forward_days" INT,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "public"."leave_requests" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organisation_id" UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  "staff_id" UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  "leave_type_id" UUID NOT NULL REFERENCES leave_types(id),
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "total_days" DECIMAL(4,1) NOT NULL,
  "reason" TEXT,
  "status" VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  "requested_by" UUID REFERENCES users(id),
  "approved_by" UUID REFERENCES users(id),
  "approved_at" TIMESTAMP,
  "rejection_reason" TEXT,
  "covered_by_staff_id" UUID REFERENCES staff(id),
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "public"."leave_balances" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organisation_id" UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  "staff_id" UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  "leave_type_id" UUID NOT NULL REFERENCES leave_types(id),
  "year" INT NOT NULL,
  "total_allotted" DECIMAL(4,1) NOT NULL,
  "used" DECIMAL(4,1) DEFAULT 0,
  "carried_forward" DECIMAL(4,1) DEFAULT 0,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP
);

-- Partial unique index for leave_balances active rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_balances_unique_active
  ON leave_balances(organisation_id, staff_id, leave_type_id, year) WHERE deleted_at IS NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leave_types_org ON leave_types(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leave_requests_org ON leave_requests(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff ON leave_requests(staff_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leave_balances_org ON leave_balances(organisation_id) WHERE deleted_at IS NULL;

INSERT INTO "public"."migrations" ("name")
VALUES ('2026-06-05-leave-management')
ON CONFLICT ("name") DO NOTHING;

COMMIT;
