-- Recreate the 6 problematic HMS tables with correct column names matching entities
-- This script should be run after dropping the old tables

-- =============================================================================
-- APPOINTMENTS TABLE (matching Appointment entity exactly)
-- =============================================================================
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clinicId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "appointmentDate" DATE NOT NULL,
    "appointmentTime" TIME NOT NULL,
    duration INT DEFAULT 30,
    status VARCHAR(50) DEFAULT 'scheduled',
    "appointmentType" VARCHAR(50) DEFAULT 'consultation',
    reason TEXT,
    notes TEXT,
    "cancelledAt" TIMESTAMP,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- DOCTORS TABLE (matching Doctor entity exactly)
-- =============================================================================
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID,
    "clinicId" UUID,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    specialization VARCHAR(255),
    qualification VARCHAR(255),
    "licenseNumber" VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(255),
    "consultationFee" DECIMAL(10, 2),
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- PRESCRIPTIONS TABLE (matching Prescription entity exactly)
-- =============================================================================
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "prescriptionNumber" VARCHAR(50) UNIQUE NOT NULL,
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "clinicId" UUID,
    "prescriptionDate" DATE NOT NULL,
    diagnosis TEXT,
    instructions TEXT,
    "followUpDate" DATE,
    status VARCHAR(50) DEFAULT 'active',
    "createdBy" UUID,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- PRESCRIPTION_ITEMS TABLE (matching PrescriptionItem entity exactly)
-- =============================================================================
CREATE TABLE IF NOT EXISTS prescription_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "prescriptionId" UUID NOT NULL,
    "medicineName" VARCHAR(255) NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    duration VARCHAR(100),
    quantity INT,
    instructions TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("prescriptionId") REFERENCES prescriptions(id) ON DELETE CASCADE
);

-- =============================================================================
-- MEDICAL_RECORDS TABLE (matching MedicalRecord entity exactly)
-- =============================================================================
CREATE TABLE IF NOT EXISTS medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "patientId" UUID NOT NULL,
    "clinicId" UUID,
    "doctorId" UUID,
    "visitDate" DATE NOT NULL,
    "chiefComplaint" TEXT,
    symptoms JSONB,
    diagnosis TEXT,
    "treatmentPlan" TEXT,
    "medicationsPrescribed" JSONB,
    "followUpDate" DATE,
    notes TEXT,
    vitals JSONB,
    attachments JSONB,
    "createdBy" UUID,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- LAB_REPORTS TABLE (matching LabReport entity exactly)
-- =============================================================================
CREATE TABLE IF NOT EXISTS lab_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "patientId" UUID NOT NULL,
    "clinicId" UUID,
    "doctorId" UUID,
    "reportType" VARCHAR(100) NOT NULL,
    "testDate" DATE NOT NULL,
    "reportDate" DATE NOT NULL,
    results JSONB,
    observations TEXT,
    conclusion TEXT,
    "fileUrl" VARCHAR(500),
    status VARCHAR(50) DEFAULT 'pending',
    "createdBy" UUID,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- LAB_TESTS TABLE (matching LabTest entity exactly)
-- =============================================================================
CREATE TABLE IF NOT EXISTS lab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "labReportId" UUID,
    "testName" VARCHAR(255) NOT NULL,
    "testCode" VARCHAR(50),
    "resultValue" VARCHAR(255),
    "resultUnit" VARCHAR(50),
    "referenceRange" VARCHAR(100),
    status VARCHAR(50),
    "isAbnormal" BOOLEAN DEFAULT false,
    notes TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("labReportId") REFERENCES lab_reports(id) ON DELETE CASCADE
);

-- =============================================================================
-- INVOICES TABLE (matching Invoice entity exactly - check entity first)
-- =============================================================================
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "invoiceNumber" VARCHAR(50) UNIQUE NOT NULL,
    "organisationId" UUID NOT NULL,
    "customerId" UUID,
    "customerName" VARCHAR(255),
    "customerEmail" VARCHAR(255),
    "customerPhone" VARCHAR(20),
    "customerAddress" TEXT,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    "taxAmount" DECIMAL(12, 2) DEFAULT 0,
    "discountAmount" DECIMAL(12, 2) DEFAULT 0,
    "totalAmount" DECIMAL(12, 2) NOT NULL,
    "paidAmount" DECIMAL(12, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    "paymentStatus" VARCHAR(50) DEFAULT 'unpaid',
    notes TEXT,
    terms TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- CREATE INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments("patientId");
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments("doctorId");
CREATE INDEX IF NOT EXISTS idx_appointments_clinic ON appointments("clinicId");
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments("appointmentDate");

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions("patientId");
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON prescriptions("doctorId");

CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records("patientId");
CREATE INDEX IF NOT EXISTS idx_medical_records_visit_date ON medical_records("visitDate");

CREATE INDEX IF NOT EXISTS idx_lab_reports_patient ON lab_reports("patientId");
CREATE INDEX IF NOT EXISTS idx_lab_reports_test_date ON lab_reports("testDate");

CREATE INDEX IF NOT EXISTS idx_invoices_organisation ON invoices("organisationId");
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices("customerId");

-- =============================================================================
-- VERIFICATION
-- =============================================================================
SELECT 
    'Created table: ' || table_name as result
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'appointments', 'doctors', 'prescriptions', 'prescription_items',
    'medical_records', 'lab_reports', 'lab_tests', 'invoices'
)
ORDER BY table_name;
