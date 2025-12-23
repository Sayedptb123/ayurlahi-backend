-- Migration: Create Patient Billing Tables
-- Description: Creates the patient_bills and bill_items tables for HMS patient billing
-- Date: 2025-12-24

CREATE TYPE bill_status AS ENUM ('draft', 'pending', 'partial', 'paid', 'cancelled');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'online', 'cheque');
CREATE TYPE bill_item_type AS ENUM ('consultation', 'medicine', 'lab-test', 'procedure', 'other');

CREATE TABLE IF NOT EXISTS "patient_bills" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clinicId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "appointmentId" UUID,
    "billNumber" VARCHAR(100) NOT NULL UNIQUE,
    "billDate" DATE NOT NULL,
    "dueDate" DATE,
    "subtotal" DECIMAL(12, 2) NOT NULL,
    "discount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12, 2) NOT NULL,
    "paidAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(12, 2) NOT NULL,
    "status" bill_status NOT NULL DEFAULT 'draft',
    "paymentMethod" payment_method,
    "notes" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "bill_items" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "billId" UUID NOT NULL,
    "itemType" bill_item_type NOT NULL,
    "itemName" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12, 2) NOT NULL,
    "discount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12, 2) NOT NULL,
    "description" TEXT
);

-- Create indexes for patient_bills
CREATE INDEX IF NOT EXISTS "IDX_patient_bills_clinicId" ON "patient_bills"("clinicId");
CREATE INDEX IF NOT EXISTS "IDX_patient_bills_patientId" ON "patient_bills"("patientId");
CREATE INDEX IF NOT EXISTS "IDX_patient_bills_appointmentId" ON "patient_bills"("appointmentId");
CREATE INDEX IF NOT EXISTS "IDX_patient_bills_billNumber" ON "patient_bills"("billNumber");
CREATE INDEX IF NOT EXISTS "IDX_patient_bills_status" ON "patient_bills"("status");
CREATE INDEX IF NOT EXISTS "IDX_patient_bills_billDate" ON "patient_bills"("billDate");

-- Create indexes for bill_items
CREATE INDEX IF NOT EXISTS "IDX_bill_items_billId" ON "bill_items"("billId");

-- Add foreign key constraints for patient_bills
ALTER TABLE "patient_bills"
    ADD CONSTRAINT "FK_patient_bills_clinic" 
    FOREIGN KEY ("clinicId") 
    REFERENCES "clinics"("id") 
    ON DELETE CASCADE;

ALTER TABLE "patient_bills"
    ADD CONSTRAINT "FK_patient_bills_patient" 
    FOREIGN KEY ("patientId") 
    REFERENCES "patients"("id") 
    ON DELETE CASCADE;

ALTER TABLE "patient_bills"
    ADD CONSTRAINT "FK_patient_bills_appointment" 
    FOREIGN KEY ("appointmentId") 
    REFERENCES "appointments"("id") 
    ON DELETE SET NULL;

-- Add foreign key constraints for bill_items
ALTER TABLE "bill_items"
    ADD CONSTRAINT "FK_bill_items_bill" 
    FOREIGN KEY ("billId") 
    REFERENCES "patient_bills"("id") 
    ON DELETE CASCADE;

COMMENT ON TABLE "patient_bills" IS 'Stores patient billing information for HMS';
COMMENT ON TABLE "bill_items" IS 'Stores individual items in patient bills';

