BEGIN;

-- ============================================================================
-- 1. DISPUTES TABLE
-- ============================================================================

-- Create Enums if they don't exist
DO $$ BEGIN
    CREATE TYPE dispute_type_enum AS ENUM ('order_issue', 'quality_issue', 'delivery_issue', 'payment_issue', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE dispute_status_enum AS ENUM ('open', 'in_review', 'resolved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "disputes" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "clinicId" UUID NOT NULL,
    "type" dispute_type_enum NOT NULL,
    "status" dispute_status_enum DEFAULT 'open' NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB,
    "assignedTo" UUID,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP,
    "resolvedBy" UUID,
    "comments" JSONB,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" TIMESTAMP,
    CONSTRAINT "fk_disputes_order" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE CASCADE,
    CONSTRAINT "fk_disputes_clinic" FOREIGN KEY ("clinicId") REFERENCES "clinics" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_disputes_orderId" ON "disputes"("orderId");
CREATE INDEX IF NOT EXISTS "IDX_disputes_clinicId" ON "disputes"("clinicId");
CREATE INDEX IF NOT EXISTS "IDX_disputes_status" ON "disputes"("status");

-- ============================================================================
-- 2. INVOICES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "invoices" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL UNIQUE,
    "invoiceNumber" VARCHAR(50) NOT NULL UNIQUE,
    "s3Key" VARCHAR(500) NOT NULL,
    "s3Url" VARCHAR(500) NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "dueDate" DATE,
    "clinicDetails" JSONB NOT NULL,
    "items" JSONB NOT NULL,
    "subtotal" DECIMAL(12, 2) NOT NULL,
    "gstAmount" DECIMAL(12, 2) NOT NULL,
    "shippingCharges" DECIMAL(12, 2) NOT NULL,
    "platformFee" DECIMAL(12, 2) NOT NULL,
    "totalAmount" DECIMAL(12, 2) NOT NULL,
    "isGstInvoice" BOOLEAN DEFAULT false NOT NULL,
    "hsnCode" VARCHAR(20),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" TIMESTAMP,
    CONSTRAINT "fk_invoices_order" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_invoices_orderId" ON "invoices"("orderId");
CREATE INDEX IF NOT EXISTS "IDX_invoices_invoiceNumber" ON "invoices"("invoiceNumber");

COMMIT;
