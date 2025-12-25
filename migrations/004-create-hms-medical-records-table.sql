-- Migration: Create Medical Records Table
-- Description: Creates the medical_records table for HMS medical record management
-- Date: 2025-12-24

CREATE TABLE IF NOT EXISTS "medical_records" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clinicId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "appointmentId" UUID,
    "doctorId" UUID NOT NULL,
    "visitDate" DATE NOT NULL,
    "chiefComplaint" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "treatment" TEXT NOT NULL,
    "vitals" JSONB,
    "notes" TEXT,
    "attachments" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "IDX_medical_records_clinicId" ON "medical_records"("clinicId");
CREATE INDEX IF NOT EXISTS "IDX_medical_records_patientId" ON "medical_records"("patientId");
CREATE INDEX IF NOT EXISTS "IDX_medical_records_doctorId" ON "medical_records"("doctorId");
CREATE INDEX IF NOT EXISTS "IDX_medical_records_appointmentId" ON "medical_records"("appointmentId");
CREATE INDEX IF NOT EXISTS "IDX_medical_records_visitDate" ON "medical_records"("visitDate");

-- Add foreign key constraints
ALTER TABLE "medical_records"
    ADD CONSTRAINT "FK_medical_records_clinic" 
    FOREIGN KEY ("clinicId") 
    REFERENCES "clinics"("id") 
    ON DELETE CASCADE;

ALTER TABLE "medical_records"
    ADD CONSTRAINT "FK_medical_records_patient" 
    FOREIGN KEY ("patientId") 
    REFERENCES "patients"("id") 
    ON DELETE CASCADE;

ALTER TABLE "medical_records"
    ADD CONSTRAINT "FK_medical_records_appointment" 
    FOREIGN KEY ("appointmentId") 
    REFERENCES "appointments"("id") 
    ON DELETE SET NULL;

ALTER TABLE "medical_records"
    ADD CONSTRAINT "FK_medical_records_doctor" 
    FOREIGN KEY ("doctorId") 
    REFERENCES "doctors"("id") 
    ON DELETE CASCADE;

COMMENT ON TABLE "medical_records" IS 'Stores medical records for HMS';



