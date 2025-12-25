-- Migration: Create Lab Reports and Lab Tests Tables
-- Description: Creates the lab_reports and lab_tests tables for HMS lab report management
-- Date: 2025-12-24

CREATE TYPE lab_report_status AS ENUM ('ordered', 'sample-collected', 'in-progress', 'completed', 'cancelled');
CREATE TYPE lab_test_status AS ENUM ('pending', 'completed', 'abnormal');

CREATE TABLE IF NOT EXISTS "lab_reports" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clinicId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "appointmentId" UUID,
    "doctorId" UUID NOT NULL,
    "reportNumber" VARCHAR(100) NOT NULL UNIQUE,
    "orderDate" DATE NOT NULL,
    "collectionDate" DATE,
    "reportDate" DATE,
    "status" lab_report_status NOT NULL DEFAULT 'ordered',
    "notes" TEXT,
    "reportFile" VARCHAR(500),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "lab_tests" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "labReportId" UUID NOT NULL,
    "testName" VARCHAR(255) NOT NULL,
    "testCode" VARCHAR(100),
    "result" TEXT,
    "normalRange" VARCHAR(100),
    "unit" VARCHAR(50),
    "status" lab_test_status NOT NULL DEFAULT 'pending',
    "notes" TEXT
);

-- Create indexes for lab_reports
CREATE INDEX IF NOT EXISTS "IDX_lab_reports_clinicId" ON "lab_reports"("clinicId");
CREATE INDEX IF NOT EXISTS "IDX_lab_reports_patientId" ON "lab_reports"("patientId");
CREATE INDEX IF NOT EXISTS "IDX_lab_reports_doctorId" ON "lab_reports"("doctorId");
CREATE INDEX IF NOT EXISTS "IDX_lab_reports_appointmentId" ON "lab_reports"("appointmentId");
CREATE INDEX IF NOT EXISTS "IDX_lab_reports_reportNumber" ON "lab_reports"("reportNumber");
CREATE INDEX IF NOT EXISTS "IDX_lab_reports_status" ON "lab_reports"("status");
CREATE INDEX IF NOT EXISTS "IDX_lab_reports_orderDate" ON "lab_reports"("orderDate");

-- Create indexes for lab_tests
CREATE INDEX IF NOT EXISTS "IDX_lab_tests_labReportId" ON "lab_tests"("labReportId");

-- Add foreign key constraints for lab_reports
ALTER TABLE "lab_reports"
    ADD CONSTRAINT "FK_lab_reports_clinic" 
    FOREIGN KEY ("clinicId") 
    REFERENCES "clinics"("id") 
    ON DELETE CASCADE;

ALTER TABLE "lab_reports"
    ADD CONSTRAINT "FK_lab_reports_patient" 
    FOREIGN KEY ("patientId") 
    REFERENCES "patients"("id") 
    ON DELETE CASCADE;

ALTER TABLE "lab_reports"
    ADD CONSTRAINT "FK_lab_reports_appointment" 
    FOREIGN KEY ("appointmentId") 
    REFERENCES "appointments"("id") 
    ON DELETE SET NULL;

ALTER TABLE "lab_reports"
    ADD CONSTRAINT "FK_lab_reports_doctor" 
    FOREIGN KEY ("doctorId") 
    REFERENCES "doctors"("id") 
    ON DELETE CASCADE;

-- Add foreign key constraints for lab_tests
ALTER TABLE "lab_tests"
    ADD CONSTRAINT "FK_lab_tests_lab_report" 
    FOREIGN KEY ("labReportId") 
    REFERENCES "lab_reports"("id") 
    ON DELETE CASCADE;

COMMENT ON TABLE "lab_reports" IS 'Stores lab report information for HMS';
COMMENT ON TABLE "lab_tests" IS 'Stores individual test items in lab reports';



