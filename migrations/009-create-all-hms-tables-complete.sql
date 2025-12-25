-- ============================================================================
-- HMS Complete Migration - All Tables in One File
-- ============================================================================
-- Description: Complete migration file with all HMS tables
-- Date: 2025-12-24
-- Usage: psql -U your_username -d ayurlahi -f migrations/009-create-all-hms-tables-complete.sql
-- 
-- This file combines all HMS migrations into a single file for easy execution
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PATIENTS TABLE
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS "IDX_patients_clinicId" ON "patients"("clinicId");
CREATE INDEX IF NOT EXISTS "IDX_patients_patientId" ON "patients"("patientId");
CREATE INDEX IF NOT EXISTS "IDX_patients_email" ON "patients"("email");
CREATE INDEX IF NOT EXISTS "IDX_patients_phone" ON "patients"("phone");

ALTER TABLE "patients"
    ADD CONSTRAINT "FK_patients_clinic" 
    FOREIGN KEY ("clinicId") 
    REFERENCES "clinics"("id") 
    ON DELETE CASCADE;

COMMENT ON TABLE "patients" IS 'Stores patient information for HMS';

-- ============================================================================
-- 2. DOCTORS TABLE
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS "IDX_doctors_clinicId" ON "doctors"("clinicId");
CREATE INDEX IF NOT EXISTS "IDX_doctors_doctorId" ON "doctors"("doctorId");
CREATE INDEX IF NOT EXISTS "IDX_doctors_userId" ON "doctors"("userId");
CREATE INDEX IF NOT EXISTS "IDX_doctors_isActive" ON "doctors"("isActive");
CREATE INDEX IF NOT EXISTS "IDX_doctors_specialization" ON "doctors"("specialization");

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

-- ============================================================================
-- 3. APPOINTMENTS TABLE
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE appointment_type AS ENUM ('consultation', 'follow-up', 'emergency', 'checkup');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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

CREATE INDEX IF NOT EXISTS "IDX_appointments_clinicId" ON "appointments"("clinicId");
CREATE INDEX IF NOT EXISTS "IDX_appointments_patientId" ON "appointments"("patientId");
CREATE INDEX IF NOT EXISTS "IDX_appointments_doctorId" ON "appointments"("doctorId");
CREATE INDEX IF NOT EXISTS "IDX_appointments_date" ON "appointments"("appointmentDate");
CREATE INDEX IF NOT EXISTS "IDX_appointments_status" ON "appointments"("status");
CREATE INDEX IF NOT EXISTS "IDX_appointments_doctor_date" ON "appointments"("doctorId", "appointmentDate");

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

-- ============================================================================
-- 4. MEDICAL RECORDS TABLE
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS "IDX_medical_records_clinicId" ON "medical_records"("clinicId");
CREATE INDEX IF NOT EXISTS "IDX_medical_records_patientId" ON "medical_records"("patientId");
CREATE INDEX IF NOT EXISTS "IDX_medical_records_doctorId" ON "medical_records"("doctorId");
CREATE INDEX IF NOT EXISTS "IDX_medical_records_appointmentId" ON "medical_records"("appointmentId");
CREATE INDEX IF NOT EXISTS "IDX_medical_records_visitDate" ON "medical_records"("visitDate");

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

-- ============================================================================
-- 5. PRESCRIPTIONS TABLES
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE prescription_status AS ENUM ('active', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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

CREATE INDEX IF NOT EXISTS "IDX_prescriptions_clinicId" ON "prescriptions"("clinicId");
CREATE INDEX IF NOT EXISTS "IDX_prescriptions_patientId" ON "prescriptions"("patientId");
CREATE INDEX IF NOT EXISTS "IDX_prescriptions_doctorId" ON "prescriptions"("doctorId");
CREATE INDEX IF NOT EXISTS "IDX_prescriptions_appointmentId" ON "prescriptions"("appointmentId");
CREATE INDEX IF NOT EXISTS "IDX_prescriptions_status" ON "prescriptions"("status");
CREATE INDEX IF NOT EXISTS "IDX_prescriptions_date" ON "prescriptions"("prescriptionDate");
CREATE INDEX IF NOT EXISTS "IDX_prescription_items_prescriptionId" ON "prescription_items"("prescriptionId");

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

ALTER TABLE "prescription_items"
    ADD CONSTRAINT "FK_prescription_items_prescription" 
    FOREIGN KEY ("prescriptionId") 
    REFERENCES "prescriptions"("id") 
    ON DELETE CASCADE;

COMMENT ON TABLE "prescriptions" IS 'Stores prescription information for HMS';
COMMENT ON TABLE "prescription_items" IS 'Stores individual medicine items in prescriptions';

-- ============================================================================
-- 6. LAB REPORTS TABLES
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE lab_report_status AS ENUM ('ordered', 'sample-collected', 'in-progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lab_test_status AS ENUM ('pending', 'completed', 'abnormal');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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

CREATE INDEX IF NOT EXISTS "IDX_lab_reports_clinicId" ON "lab_reports"("clinicId");
CREATE INDEX IF NOT EXISTS "IDX_lab_reports_patientId" ON "lab_reports"("patientId");
CREATE INDEX IF NOT EXISTS "IDX_lab_reports_doctorId" ON "lab_reports"("doctorId");
CREATE INDEX IF NOT EXISTS "IDX_lab_reports_appointmentId" ON "lab_reports"("appointmentId");
CREATE INDEX IF NOT EXISTS "IDX_lab_reports_reportNumber" ON "lab_reports"("reportNumber");
CREATE INDEX IF NOT EXISTS "IDX_lab_reports_status" ON "lab_reports"("status");
CREATE INDEX IF NOT EXISTS "IDX_lab_reports_orderDate" ON "lab_reports"("orderDate");
CREATE INDEX IF NOT EXISTS "IDX_lab_tests_labReportId" ON "lab_tests"("labReportId");

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

ALTER TABLE "lab_tests"
    ADD CONSTRAINT "FK_lab_tests_lab_report" 
    FOREIGN KEY ("labReportId") 
    REFERENCES "lab_reports"("id") 
    ON DELETE CASCADE;

COMMENT ON TABLE "lab_reports" IS 'Stores lab report information for HMS';
COMMENT ON TABLE "lab_tests" IS 'Stores individual test items in lab reports';

-- ============================================================================
-- 7. PATIENT BILLING TABLES
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE bill_status AS ENUM ('draft', 'pending', 'partial', 'paid', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('cash', 'card', 'online', 'cheque');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE bill_item_type AS ENUM ('consultation', 'medicine', 'lab-test', 'procedure', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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

CREATE INDEX IF NOT EXISTS "IDX_patient_bills_clinicId" ON "patient_bills"("clinicId");
CREATE INDEX IF NOT EXISTS "IDX_patient_bills_patientId" ON "patient_bills"("patientId");
CREATE INDEX IF NOT EXISTS "IDX_patient_bills_appointmentId" ON "patient_bills"("appointmentId");
CREATE INDEX IF NOT EXISTS "IDX_patient_bills_billNumber" ON "patient_bills"("billNumber");
CREATE INDEX IF NOT EXISTS "IDX_patient_bills_status" ON "patient_bills"("status");
CREATE INDEX IF NOT EXISTS "IDX_patient_bills_billDate" ON "patient_bills"("billDate");
CREATE INDEX IF NOT EXISTS "IDX_bill_items_billId" ON "bill_items"("billId");

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

ALTER TABLE "bill_items"
    ADD CONSTRAINT "FK_bill_items_bill" 
    FOREIGN KEY ("billId") 
    REFERENCES "patient_bills"("id") 
    ON DELETE CASCADE;

COMMENT ON TABLE "patient_bills" IS 'Stores patient billing information for HMS';
COMMENT ON TABLE "bill_items" IS 'Stores individual items in patient bills';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all tables were created
SELECT 
    table_name,
    '✓ Created' as status
FROM 
    information_schema.tables 
WHERE 
    table_schema = 'public' 
    AND table_name IN (
        'patients',
        'doctors',
        'appointments',
        'medical_records',
        'prescriptions',
        'prescription_items',
        'lab_reports',
        'lab_tests',
        'patient_bills',
        'bill_items'
    )
ORDER BY 
    table_name;

COMMIT;

-- ============================================================================
-- Migration Complete!
-- ============================================================================
-- All 10 HMS tables have been created successfully.
-- Next steps:
-- 1. Start the server: npm run start:dev
-- 2. Test API endpoints
-- ============================================================================



