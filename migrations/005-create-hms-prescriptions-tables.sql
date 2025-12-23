-- Migration: Create Prescriptions and Prescription Items Tables
-- Description: Creates the prescriptions and prescription_items tables for HMS prescription management
-- Date: 2025-12-24

CREATE TYPE prescription_status AS ENUM ('active', 'completed', 'cancelled');

CREATE TABLE IF NOT EXISTS "prescriptions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clinicId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "appointmentId" UUID,
    "doctorId" UUID NOT NULL,
    "prescriptionDate" DATE NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "notes" TEXT,
    "status" prescription_status NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "prescription_items" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "prescriptionId" UUID NOT NULL,
    "medicineName" VARCHAR(255) NOT NULL,
    "dosage" VARCHAR(100),
    "frequency" VARCHAR(100),
    "duration" VARCHAR(100),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "instructions" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0
);

-- Create indexes for prescriptions
CREATE INDEX IF NOT EXISTS "IDX_prescriptions_clinicId" ON "prescriptions"("clinicId");
CREATE INDEX IF NOT EXISTS "IDX_prescriptions_patientId" ON "prescriptions"("patientId");
CREATE INDEX IF NOT EXISTS "IDX_prescriptions_doctorId" ON "prescriptions"("doctorId");
CREATE INDEX IF NOT EXISTS "IDX_prescriptions_appointmentId" ON "prescriptions"("appointmentId");
CREATE INDEX IF NOT EXISTS "IDX_prescriptions_status" ON "prescriptions"("status");
CREATE INDEX IF NOT EXISTS "IDX_prescriptions_date" ON "prescriptions"("prescriptionDate");

-- Create indexes for prescription_items
CREATE INDEX IF NOT EXISTS "IDX_prescription_items_prescriptionId" ON "prescription_items"("prescriptionId");

-- Add foreign key constraints for prescriptions
ALTER TABLE "prescriptions"
    ADD CONSTRAINT "FK_prescriptions_clinic" 
    FOREIGN KEY ("clinicId") 
    REFERENCES "clinics"("id") 
    ON DELETE CASCADE;

ALTER TABLE "prescriptions"
    ADD CONSTRAINT "FK_prescriptions_patient" 
    FOREIGN KEY ("patientId") 
    REFERENCES "patients"("id") 
    ON DELETE CASCADE;

ALTER TABLE "prescriptions"
    ADD CONSTRAINT "FK_prescriptions_appointment" 
    FOREIGN KEY ("appointmentId") 
    REFERENCES "appointments"("id") 
    ON DELETE SET NULL;

ALTER TABLE "prescriptions"
    ADD CONSTRAINT "FK_prescriptions_doctor" 
    FOREIGN KEY ("doctorId") 
    REFERENCES "doctors"("id") 
    ON DELETE CASCADE;

-- Add foreign key constraints for prescription_items
ALTER TABLE "prescription_items"
    ADD CONSTRAINT "FK_prescription_items_prescription" 
    FOREIGN KEY ("prescriptionId") 
    REFERENCES "prescriptions"("id") 
    ON DELETE CASCADE;

COMMENT ON TABLE "prescriptions" IS 'Stores prescription information for HMS';
COMMENT ON TABLE "prescription_items" IS 'Stores individual medicine items in prescriptions';

