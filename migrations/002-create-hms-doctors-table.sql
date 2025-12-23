-- Migration: Create Doctors Table
-- Description: Creates the doctors table for HMS doctor management
-- Date: 2025-12-24

CREATE TABLE IF NOT EXISTS "doctors" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clinicId" UUID NOT NULL,
    "userId" UUID,
    "doctorId" VARCHAR(50) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "specialization" VARCHAR(255) NOT NULL,
    "qualification" JSONB,
    "licenseNumber" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "consultationFee" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "schedule" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UQ_doctors_clinic_doctorId" UNIQUE ("clinicId", "doctorId")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "IDX_doctors_clinicId" ON "doctors"("clinicId");
CREATE INDEX IF NOT EXISTS "IDX_doctors_doctorId" ON "doctors"("doctorId");
CREATE INDEX IF NOT EXISTS "IDX_doctors_userId" ON "doctors"("userId");
CREATE INDEX IF NOT EXISTS "IDX_doctors_isActive" ON "doctors"("isActive");
CREATE INDEX IF NOT EXISTS "IDX_doctors_specialization" ON "doctors"("specialization");

-- Add foreign key constraints
ALTER TABLE "doctors"
    ADD CONSTRAINT "FK_doctors_clinic" 
    FOREIGN KEY ("clinicId") 
    REFERENCES "clinics"("id") 
    ON DELETE CASCADE;

ALTER TABLE "doctors"
    ADD CONSTRAINT "FK_doctors_user" 
    FOREIGN KEY ("userId") 
    REFERENCES "users"("id") 
    ON DELETE SET NULL;

COMMENT ON TABLE "doctors" IS 'Stores doctor information for HMS';

