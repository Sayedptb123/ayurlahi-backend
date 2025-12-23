-- Migration: Create Patients Table
-- Description: Creates the patients table for HMS patient management
-- Date: 2025-12-24

CREATE TABLE IF NOT EXISTS "patients" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clinicId" UUID NOT NULL,
    "patientId" VARCHAR(50) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "dateOfBirth" DATE,
    "gender" VARCHAR(20) CHECK ("gender" IN ('male', 'female', 'other')),
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "address" JSONB,
    "emergencyContact" JSONB,
    "bloodGroup" VARCHAR(10),
    "allergies" JSONB,
    "medicalHistory" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UQ_patients_clinic_patientId" UNIQUE ("clinicId", "patientId")
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "IDX_patients_clinicId" ON "patients"("clinicId");
CREATE INDEX IF NOT EXISTS "IDX_patients_patientId" ON "patients"("patientId");
CREATE INDEX IF NOT EXISTS "IDX_patients_email" ON "patients"("email");
CREATE INDEX IF NOT EXISTS "IDX_patients_phone" ON "patients"("phone");

-- Add foreign key constraint
ALTER TABLE "patients"
    ADD CONSTRAINT "FK_patients_clinic" 
    FOREIGN KEY ("clinicId") 
    REFERENCES "clinics"("id") 
    ON DELETE CASCADE;

-- Add comment
COMMENT ON TABLE "patients" IS 'Stores patient information for HMS';

