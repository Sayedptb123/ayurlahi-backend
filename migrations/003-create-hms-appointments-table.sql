-- Migration: Create Appointments Table
-- Description: Creates the appointments table for HMS appointment scheduling
-- Date: 2025-12-24

CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show');
CREATE TYPE appointment_type AS ENUM ('consultation', 'follow-up', 'emergency', 'checkup');

CREATE TABLE IF NOT EXISTS "appointments" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clinicId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "appointmentDate" DATE NOT NULL,
    "appointmentTime" TIME NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "status" appointment_status NOT NULL DEFAULT 'scheduled',
    "appointmentType" appointment_type NOT NULL DEFAULT 'consultation',
    "reason" TEXT,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "IDX_appointments_clinicId" ON "appointments"("clinicId");
CREATE INDEX IF NOT EXISTS "IDX_appointments_patientId" ON "appointments"("patientId");
CREATE INDEX IF NOT EXISTS "IDX_appointments_doctorId" ON "appointments"("doctorId");
CREATE INDEX IF NOT EXISTS "IDX_appointments_date" ON "appointments"("appointmentDate");
CREATE INDEX IF NOT EXISTS "IDX_appointments_status" ON "appointments"("status");
CREATE INDEX IF NOT EXISTS "IDX_appointments_doctor_date" ON "appointments"("doctorId", "appointmentDate");

-- Add foreign key constraints
ALTER TABLE "appointments"
    ADD CONSTRAINT "FK_appointments_clinic" 
    FOREIGN KEY ("clinicId") 
    REFERENCES "clinics"("id") 
    ON DELETE CASCADE;

ALTER TABLE "appointments"
    ADD CONSTRAINT "FK_appointments_patient" 
    FOREIGN KEY ("patientId") 
    REFERENCES "patients"("id") 
    ON DELETE CASCADE;

ALTER TABLE "appointments"
    ADD CONSTRAINT "FK_appointments_doctor" 
    FOREIGN KEY ("doctorId") 
    REFERENCES "doctors"("id") 
    ON DELETE CASCADE;

COMMENT ON TABLE "appointments" IS 'Stores appointment information for HMS';

