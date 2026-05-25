-- ============================================================
-- PHASE 10: Database Restructure & Data Integrity
-- Run: psql -U sayedsuhailk -d medilink -h localhost -f migrations/012-phase10-schema-restructure.sql
-- All test data (patients, appointments, bills, etc.) is wiped.
-- Identity data (organisations, users, organisation_users) is preserved.
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 0: WIPE CLINICAL/TRANSACTIONAL TEST DATA
-- Order: deepest children first to satisfy FK constraints
-- ============================================================

TRUNCATE TABLE
  wastage_logs,
  batch_stages,
  formula_items,
  process_stages,
  lab_tests, lab_reports,
  prescription_items, prescriptions,
  bill_items, patient_bills,
  room_bookings, admissions,
  appointments,
  medical_records,
  patients,
  salary_structures,
  payroll_records,
  staff_branch_assignments,
  duty_assignments, duty_templates, duty_types,
  staff_tasks,
  staff,
  doctors,
  rooms,
  order_items, orders,
  batches,
  manufacturing_formulas,
  equipment,
  inventory_transactions, inventory_items,
  purchase_order_items, purchase_orders,
  suppliers,
  products,
  budgets, expenses,
  documents,
  push_tokens,
  branches,
  clinics
CASCADE;

-- ============================================================
-- STEP 1: ORGANISATIONS — drop sparse columns, fix constraints
-- ============================================================

ALTER TABLE organisations
  DROP COLUMN IF EXISTS clinic_name,
  DROP COLUMN IF EXISTS company_name,
  DROP COLUMN IF EXISTS commission_rate,
  DROP COLUMN IF EXISTS discount_percentage,
  DROP COLUMN IF EXISTS license_number,
  DROP COLUMN IF EXISTS gstin,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS pincode,
  DROP COLUMN IF EXISTS country,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS whatsapp_number,
  DROP COLUMN IF EXISTS social_media,
  DROP COLUMN IF EXISTS is_verified,
  DROP COLUMN IF EXISTS status;

-- Add POSTNATAL_HOSPITAL to type enum
ALTER TABLE organisations DROP CONSTRAINT IF EXISTS organisations_type_check;
ALTER TABLE organisations ADD CONSTRAINT organisations_type_check
  CHECK (type IN ('AYURLAHI_TEAM', 'CLINIC', 'MANUFACTURER', 'POSTNATAL_HOSPITAL'));

-- Add suspended to approval_status
ALTER TABLE organisations DROP CONSTRAINT IF EXISTS organisations_approval_status_check;
ALTER TABLE organisations ADD CONSTRAINT organisations_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));

-- Add created_by
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- ============================================================
-- STEP 2: USERS — drop dead columns, fix unique constraints
-- ============================================================

ALTER TABLE users
  DROP COLUMN IF EXISTS role,
  DROP COLUMN IF EXISTS clinic_id,
  DROP COLUMN IF EXISTS manufacturer_id,
  DROP COLUMN IF EXISTS whatsapp_number;

-- Add deleted_at first (needed for partial index below)
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Replace column-level UNIQUEs with partial indexes (soft-delete safe)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_phone;
CREATE UNIQUE INDEX idx_users_email_unique ON users(email) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX idx_users_phone_unique ON users(phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- STEP 3: ORGANISATION_USERS — add deleted_at, updated_by
-- ============================================================

ALTER TABLE organisation_users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- Replace old unique with partial unique (only one active membership per user per org)
ALTER TABLE organisation_users DROP CONSTRAINT IF EXISTS unique_user_org_role;
DROP INDEX IF EXISTS unique_user_org_role;
CREATE UNIQUE INDEX idx_org_users_unique_active
  ON organisation_users(user_id, organisation_id)
  WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 4: STAFF — rename columns, add doctor fields, add deleted_at
-- ============================================================

-- Rename organization_id → organisation_id (American → British spelling)
ALTER TABLE staff RENAME COLUMN organization_id TO organisation_id;
ALTER TABLE staff RENAME COLUMN organization_type TO organisation_type;

-- Drop old index that used old column name
DROP INDEX IF EXISTS idx_staff_organisation_id;
DROP INDEX IF EXISTS idx_staff_organisation_active;
DROP INDEX IF EXISTS "IDX_STAFF_POSITION";
DROP INDEX IF EXISTS "IDX_STAFF_ORG_POSITION";

-- Add missing columns
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS doctor_code      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS license_number   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS consultation_fee DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS schedule         JSONB,
  ADD COLUMN IF NOT EXISTS employee_code    VARCHAR(50),
  ADD COLUMN IF NOT EXISTS address          JSONB,
  ADD COLUMN IF NOT EXISTS date_of_leaving  DATE,
  ADD COLUMN IF NOT EXISTS created_by       UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_by       UUID REFERENCES users(id);

-- Recreate indexes with new column name
CREATE INDEX IF NOT EXISTS idx_staff_organisation_id ON staff(organisation_id);
CREATE INDEX IF NOT EXISTS idx_staff_org_active ON staff(organisation_id, is_active) WHERE deleted_at IS NULL;

-- Unique doctor_code per org (nullable, only when set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_doctor_code
  ON staff(organisation_id, doctor_code)
  WHERE doctor_code IS NOT NULL AND deleted_at IS NULL;

-- Unique employee_code per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_employee_code
  ON staff(organisation_id, employee_code)
  WHERE employee_code IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- STEP 5: SALARY_STRUCTURES — allow salary history
-- ============================================================

-- Drop UNIQUE on staff_id (prevents salary revisions)
ALTER TABLE salary_structures DROP CONSTRAINT IF EXISTS salary_structures_staff_id_key;
DROP INDEX IF EXISTS "salary_structures_staff_id_key";
DROP INDEX IF EXISTS idx_salary_structure_staff;

-- Drop stored net_salary (compute in app)
ALTER TABLE salary_structures DROP COLUMN IF EXISTS net_salary;

-- Flatten individual allowance columns into JSONB (keep existing for backward compat, add new)
-- We keep hra, da, etc. for now and add allowances JSONB as the new canonical store
ALTER TABLE salary_structures ADD COLUMN IF NOT EXISTS allowances JSONB DEFAULT '[]';
ALTER TABLE salary_structures ADD COLUMN IF NOT EXISTS effective_from DATE;
ALTER TABLE salary_structures ADD COLUMN IF NOT EXISTS effective_to DATE;

-- Partial unique: only one active salary per staff (effective_to IS NULL = current)
CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_current
  ON salary_structures(staff_id)
  WHERE effective_to IS NULL;

-- ============================================================
-- STEP 6: ROOMS — rename clinicId, add organisation FK, deleted_at
-- ============================================================

ALTER TABLE rooms RENAME COLUMN "clinicId" TO organisation_id;
ALTER TABLE rooms RENAME COLUMN "roomNumber" TO room_number;

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

ALTER TABLE rooms ADD CONSTRAINT rooms_organisation_id_fkey
  FOREIGN KEY (organisation_id) REFERENCES organisations(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_org_number
  ON rooms(organisation_id, room_number)
  WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 7: PATIENTS — rename to snake_case, add FK + deleted_at
-- ============================================================

ALTER TABLE patients RENAME COLUMN "clinicId"          TO organisation_id;
ALTER TABLE patients RENAME COLUMN "patientId"         TO patient_code;
ALTER TABLE patients RENAME COLUMN "firstName"         TO first_name;
ALTER TABLE patients RENAME COLUMN "lastName"          TO last_name;
ALTER TABLE patients RENAME COLUMN "dateOfBirth"       TO date_of_birth;
ALTER TABLE patients RENAME COLUMN "emergencyContact"  TO emergency_contact;
ALTER TABLE patients RENAME COLUMN "bloodGroup"        TO blood_group;
ALTER TABLE patients RENAME COLUMN "medicalHistory"    TO medical_history;
ALTER TABLE patients RENAME COLUMN "motherPatientId"   TO mother_patient_id;
ALTER TABLE patients RENAME COLUMN "createdAt"         TO created_at;
ALTER TABLE patients RENAME COLUMN "updatedAt"         TO updated_at;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_by  UUID REFERENCES users(id);

ALTER TABLE patients ADD CONSTRAINT patients_organisation_id_fkey
  FOREIGN KEY (organisation_id) REFERENCES organisations(id);

ALTER TABLE patients ADD CONSTRAINT chk_patient_no_self_mother
  CHECK (mother_patient_id IS NULL OR mother_patient_id != id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_org_code
  ON patients(organisation_id, patient_code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_patients_org_created
  ON patients(organisation_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_patients_org_phone
  ON patients(organisation_id, phone)
  WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 8: DOCTORS — migrate to staff, then drop table
-- ============================================================
-- (No data to migrate — wiped in STEP 0)
-- Drop FK from staff_tasks that references doctors
ALTER TABLE staff_tasks DROP CONSTRAINT IF EXISTS "staff_tasks_assignedToDoctorId_fkey";

-- Add a staff-based column to staff_tasks
ALTER TABLE staff_tasks ADD COLUMN IF NOT EXISTS assigned_to_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;

-- Drop doctors table
DROP TABLE IF EXISTS doctors CASCADE;

-- ============================================================
-- STEP 9: APPOINTMENTS — rename, add FKs, deleted_at
-- ============================================================

DROP INDEX IF EXISTS idx_appointments_clinic;
DROP INDEX IF EXISTS idx_appointments_date;
DROP INDEX IF EXISTS idx_appointments_doctor;
DROP INDEX IF EXISTS idx_appointments_patient;

ALTER TABLE appointments RENAME COLUMN "clinicId"           TO organisation_id;
ALTER TABLE appointments RENAME COLUMN "patientId"          TO patient_id;
ALTER TABLE appointments RENAME COLUMN "doctorId"           TO doctor_id;
ALTER TABLE appointments RENAME COLUMN "appointmentDate"    TO appointment_date;
ALTER TABLE appointments RENAME COLUMN "appointmentTime"    TO appointment_time;
ALTER TABLE appointments RENAME COLUMN "appointmentType"    TO appointment_type;
ALTER TABLE appointments RENAME COLUMN "cancelledAt"        TO cancelled_at;
ALTER TABLE appointments RENAME COLUMN "cancellationReason" TO cancellation_reason;
ALTER TABLE appointments RENAME COLUMN "createdAt"          TO created_at;
ALTER TABLE appointments RENAME COLUMN "updatedAt"          TO updated_at;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS branch_id   UUID REFERENCES branches(id),
  ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_by  UUID REFERENCES users(id);

ALTER TABLE appointments ADD CONSTRAINT appointments_organisation_id_fkey
  FOREIGN KEY (organisation_id) REFERENCES organisations(id);
ALTER TABLE appointments ADD CONSTRAINT appointments_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES patients(id);
ALTER TABLE appointments ADD CONSTRAINT appointments_doctor_id_fkey
  FOREIGN KEY (doctor_id) REFERENCES staff(id);

CREATE INDEX IF NOT EXISTS idx_appt_org_date
  ON appointments(organisation_id, appointment_date DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appt_org_doctor_date
  ON appointments(organisation_id, doctor_id, appointment_date)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appt_org_patient
  ON appointments(organisation_id, patient_id)
  WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 10: PRESCRIPTIONS — rename, add FKs, deleted_at
-- ============================================================

ALTER TABLE prescriptions RENAME COLUMN "clinicId"        TO organisation_id;
ALTER TABLE prescriptions RENAME COLUMN "patientId"       TO patient_id;
ALTER TABLE prescriptions RENAME COLUMN "appointmentId"   TO appointment_id;
ALTER TABLE prescriptions RENAME COLUMN "doctorId"        TO doctor_id;
ALTER TABLE prescriptions RENAME COLUMN "prescriptionDate" TO prescription_date;
ALTER TABLE prescriptions RENAME COLUMN "createdAt"       TO created_at;
ALTER TABLE prescriptions RENAME COLUMN "updatedAt"       TO updated_at;

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_organisation_id_fkey
  FOREIGN KEY (organisation_id) REFERENCES organisations(id);
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES patients(id);
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_doctor_id_fkey
  FOREIGN KEY (doctor_id) REFERENCES staff(id);

-- Fix status to lowercase
UPDATE prescriptions SET status = LOWER(status);

CREATE INDEX IF NOT EXISTS idx_prescriptions_org_patient
  ON prescriptions(organisation_id, patient_id)
  WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 11: MEDICAL RECORDS — rename, add FKs, deleted_at
-- ============================================================

ALTER TABLE medical_records RENAME COLUMN "clinicId"       TO organisation_id;
ALTER TABLE medical_records RENAME COLUMN "patientId"      TO patient_id;
ALTER TABLE medical_records RENAME COLUMN "appointmentId"  TO appointment_id;
ALTER TABLE medical_records RENAME COLUMN "doctorId"       TO doctor_id;
ALTER TABLE medical_records RENAME COLUMN "visitDate"      TO visit_date;
ALTER TABLE medical_records RENAME COLUMN "chiefComplaint" TO chief_complaint;
ALTER TABLE medical_records RENAME COLUMN "createdAt"      TO created_at;
ALTER TABLE medical_records RENAME COLUMN "updatedAt"      TO updated_at;

ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

ALTER TABLE medical_records ADD CONSTRAINT medical_records_organisation_id_fkey
  FOREIGN KEY (organisation_id) REFERENCES organisations(id);
ALTER TABLE medical_records ADD CONSTRAINT medical_records_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES patients(id);
ALTER TABLE medical_records ADD CONSTRAINT medical_records_doctor_id_fkey
  FOREIGN KEY (doctor_id) REFERENCES staff(id);

CREATE INDEX IF NOT EXISTS idx_medical_records_org_patient
  ON medical_records(organisation_id, patient_id, visit_date DESC)
  WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 12: LAB REPORTS — rename, add FKs, deleted_at
-- ============================================================

ALTER TABLE lab_reports RENAME COLUMN "clinicId"        TO organisation_id;
ALTER TABLE lab_reports RENAME COLUMN "patientId"       TO patient_id;
ALTER TABLE lab_reports RENAME COLUMN "appointmentId"   TO appointment_id;
ALTER TABLE lab_reports RENAME COLUMN "doctorId"        TO doctor_id;
ALTER TABLE lab_reports RENAME COLUMN "reportNumber"    TO report_number;
ALTER TABLE lab_reports RENAME COLUMN "orderDate"       TO order_date;
ALTER TABLE lab_reports RENAME COLUMN "collectionDate"  TO collection_date;
ALTER TABLE lab_reports RENAME COLUMN "reportDate"      TO report_date;
ALTER TABLE lab_reports RENAME COLUMN "reportFile"      TO report_file;
ALTER TABLE lab_reports RENAME COLUMN "createdAt"       TO created_at;
ALTER TABLE lab_reports RENAME COLUMN "updatedAt"       TO updated_at;

ALTER TABLE lab_reports ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Drop global unique on report_number, replace with org-scoped
ALTER TABLE lab_reports DROP CONSTRAINT IF EXISTS lab_reports_reportNumber_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_reports_org_number
  ON lab_reports(organisation_id, report_number)
  WHERE deleted_at IS NULL;

ALTER TABLE lab_reports ADD CONSTRAINT lab_reports_organisation_id_fkey
  FOREIGN KEY (organisation_id) REFERENCES organisations(id);
ALTER TABLE lab_reports ADD CONSTRAINT lab_reports_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES patients(id);
ALTER TABLE lab_reports ADD CONSTRAINT lab_reports_doctor_id_fkey
  FOREIGN KEY (doctor_id) REFERENCES staff(id);

-- Fix status to lowercase
UPDATE lab_reports SET status = LOWER(status);

CREATE INDEX IF NOT EXISTS idx_lab_reports_org_patient
  ON lab_reports(organisation_id, patient_id)
  WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 13: ADMISSIONS — rename, add FKs
-- ============================================================

ALTER TABLE admissions RENAME COLUMN "clinicId"  TO organisation_id;
ALTER TABLE admissions RENAME COLUMN "patientId" TO patient_id;
ALTER TABLE admissions RENAME COLUMN "roomId"    TO room_id;
ALTER TABLE admissions RENAME COLUMN "packageId" TO package_id;

ALTER TABLE admissions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

ALTER TABLE admissions ADD CONSTRAINT admissions_organisation_id_fkey
  FOREIGN KEY (organisation_id) REFERENCES organisations(id);
ALTER TABLE admissions ADD CONSTRAINT admissions_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES patients(id);
ALTER TABLE admissions ADD CONSTRAINT admissions_room_id_fkey
  FOREIGN KEY (room_id) REFERENCES rooms(id);

-- ============================================================
-- STEP 14: ROOM BOOKINGS — rename clinicId (FK already points to organisations)
-- ============================================================

ALTER TABLE room_bookings RENAME COLUMN "clinicId"     TO organisation_id;
ALTER TABLE room_bookings RENAME COLUMN "patientId"    TO patient_id;
ALTER TABLE room_bookings RENAME COLUMN "roomId"       TO room_id;
ALTER TABLE room_bookings RENAME COLUMN "packageId"    TO package_id;
ALTER TABLE room_bookings RENAME COLUMN "checkInDate"  TO check_in_date;
ALTER TABLE room_bookings RENAME COLUMN "checkOutDate" TO check_out_date;
ALTER TABLE room_bookings RENAME COLUMN "totalPrice"   TO total_price;
ALTER TABLE room_bookings RENAME COLUMN "advancePaid"  TO advance_paid;
ALTER TABLE room_bookings RENAME COLUMN "bookingDate"  TO booking_date;
ALTER TABLE room_bookings RENAME COLUMN "admissionId"  TO admission_id;
ALTER TABLE room_bookings RENAME COLUMN "createdAt"    TO created_at;
ALTER TABLE room_bookings RENAME COLUMN "updatedAt"    TO updated_at;

ALTER TABLE room_bookings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ============================================================
-- STEP 15: PATIENT BILLS — rename, add FKs, drop balance
-- ============================================================

ALTER TABLE patient_bills RENAME COLUMN "clinicId"      TO organisation_id;
ALTER TABLE patient_bills RENAME COLUMN "patientId"     TO patient_id;
ALTER TABLE patient_bills RENAME COLUMN "appointmentId" TO appointment_id;
ALTER TABLE patient_bills RENAME COLUMN "billNumber"    TO bill_number;
ALTER TABLE patient_bills RENAME COLUMN "billDate"      TO bill_date;
ALTER TABLE patient_bills RENAME COLUMN "dueDate"       TO due_date;
ALTER TABLE patient_bills RENAME COLUMN "paidAmount"    TO paid_amount;
ALTER TABLE patient_bills RENAME COLUMN "paymentMethod" TO payment_method;
ALTER TABLE patient_bills RENAME COLUMN "createdAt"     TO created_at;
ALTER TABLE patient_bills RENAME COLUMN "updatedAt"     TO updated_at;

-- Drop stored balance — always compute (total - paid_amount) in app
ALTER TABLE patient_bills DROP COLUMN IF EXISTS balance;

ALTER TABLE patient_bills
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_by  UUID REFERENCES users(id);

-- Drop old global unique, add org-scoped partial
ALTER TABLE patient_bills DROP CONSTRAINT IF EXISTS patient_bills_billNumber_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_org_number
  ON patient_bills(organisation_id, bill_number)
  WHERE deleted_at IS NULL;

ALTER TABLE patient_bills ADD CONSTRAINT patient_bills_organisation_id_fkey
  FOREIGN KEY (organisation_id) REFERENCES organisations(id);
ALTER TABLE patient_bills ADD CONSTRAINT patient_bills_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES patients(id);

-- Lowercase status default
ALTER TABLE patient_bills ALTER COLUMN status SET DEFAULT 'draft';
UPDATE patient_bills SET status = LOWER(status);

ALTER TABLE patient_bills ADD CONSTRAINT chk_bills_paid_amount
  CHECK (paid_amount >= 0);

CREATE INDEX IF NOT EXISTS idx_bills_org_date
  ON patient_bills(organisation_id, bill_date DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bills_org_patient
  ON patient_bills(organisation_id, patient_id)
  WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 16: ORDERS — rename, consolidate shipping, add FK
-- ============================================================

ALTER TABLE orders RENAME COLUMN "clinicId"            TO organisation_id;
ALTER TABLE orders RENAME COLUMN "orderNumber"         TO order_number;
ALTER TABLE orders RENAME COLUMN "gstAmount"           TO gst_amount;
ALTER TABLE orders RENAME COLUMN "shippingCharges"     TO shipping_charges;
ALTER TABLE orders RENAME COLUMN "platformFee"         TO platform_fee;
ALTER TABLE orders RENAME COLUMN "totalAmount"         TO total_amount;
ALTER TABLE orders RENAME COLUMN "confirmedAt"         TO confirmed_at;
ALTER TABLE orders RENAME COLUMN "shippedAt"           TO shipped_at;
ALTER TABLE orders RENAME COLUMN "deliveredAt"         TO delivered_at;
ALTER TABLE orders RENAME COLUMN "cancelledAt"         TO cancelled_at;
ALTER TABLE orders RENAME COLUMN "cancellationReason"  TO cancellation_reason;
ALTER TABLE orders RENAME COLUMN "cancelledBy"         TO cancelled_by;
ALTER TABLE orders RENAME COLUMN "createdAt"           TO created_at;
ALTER TABLE orders RENAME COLUMN "updatedAt"           TO updated_at;
ALTER TABLE orders RENAME COLUMN "deletedAt"           TO deleted_at;

-- Consolidate separate shipping columns into JSONB snapshot
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address JSONB;

-- No data to migrate (truncated in STEP 0)
-- Drop old separate shipping columns
ALTER TABLE orders
  DROP COLUMN IF EXISTS "shippingAddress",
  DROP COLUMN IF EXISTS "shippingCity",
  DROP COLUMN IF EXISTS "shippingDistrict",
  DROP COLUMN IF EXISTS "shippingState",
  DROP COLUMN IF EXISTS "shippingPincode",
  DROP COLUMN IF EXISTS "shippingPhone",
  DROP COLUMN IF EXISTS "shippingContactName",
  DROP COLUMN IF EXISTS "whatsappMessageId",
  DROP COLUMN IF EXISTS "razorpayOrderId";

ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

ALTER TABLE orders ADD CONSTRAINT orders_organisation_id_fkey
  FOREIGN KEY (organisation_id) REFERENCES organisations(id);

CREATE INDEX IF NOT EXISTS idx_orders_org_status
  ON orders(organisation_id, status, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_addr
  ON orders USING GIN (shipping_address);

-- ============================================================
-- STEP 17: PRODUCTS — rename, fix status, add FK, add commission_rate
-- ============================================================

ALTER TABLE products RENAME COLUMN "manufacturerId"       TO manufacturer_id;
ALTER TABLE products RENAME COLUMN "batchNumber"          TO batch_number;
ALTER TABLE products RENAME COLUMN "expiryDate"           TO expiry_date;
ALTER TABLE products RENAME COLUMN "manufacturingDate"    TO manufacturing_date;
ALTER TABLE products RENAME COLUMN "fulfillmentType"      TO fulfillment_type;
ALTER TABLE products RENAME COLUMN "vendorId"             TO vendor_id;
ALTER TABLE products RENAME COLUMN "gstRate"              TO gst_rate;
ALTER TABLE products RENAME COLUMN "stockQuantity"        TO stock_quantity;
ALTER TABLE products RENAME COLUMN "minOrderQuantity"     TO min_order_quantity;
ALTER TABLE products RENAME COLUMN "requiresPrescription" TO requires_prescription;
ALTER TABLE products RENAME COLUMN "licenseNumber"        TO license_number;
ALTER TABLE products RENAME COLUMN "createdAt"            TO created_at;
ALTER TABLE products RENAME COLUMN "updatedAt"            TO updated_at;
ALTER TABLE products RENAME COLUMN "deletedAt"            TO deleted_at;
ALTER TABLE products RENAME COLUMN "packSize"             TO pack_size;

-- Drop duplicate isActive column
ALTER TABLE products DROP COLUMN IF EXISTS "isActive";

-- Fix status: drop old check, lowercase existing values, add new check
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_product_status;
UPDATE products SET status = LOWER(status);
ALTER TABLE products ADD CONSTRAINT chk_product_status
  CHECK (status IN ('draft', 'active', 'inactive', 'discontinued', 'out_of_stock', 'pending_review'));

-- Add commission_rate override per product
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2);

-- Add FK to organisations
ALTER TABLE products ADD CONSTRAINT products_manufacturer_id_fkey
  FOREIGN KEY (manufacturer_id) REFERENCES organisations(id);

-- Replace global unique sku with manufacturer-scoped unique
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_mfg_sku
  ON products(manufacturer_id, sku)
  WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 18: BATCHES — add deleted_at, fix unique constraint
-- ============================================================

ALTER TABLE batches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Drop global unique batch_number, replace with org-scoped partial
ALTER TABLE batches DROP CONSTRAINT IF EXISTS "UQ_batches_batch_number";
CREATE UNIQUE INDEX IF NOT EXISTS idx_batches_mfg_number
  ON batches(manufacturer_id, batch_number)
  WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 19: PAYROLL RECORDS — rename organization_id → organisation_id
-- ============================================================

ALTER TABLE payroll_records RENAME COLUMN organization_id TO organisation_id;

-- Recreate index with new column name
DROP INDEX IF EXISTS idx_payroll_org_month_year;
CREATE INDEX IF NOT EXISTS idx_payroll_org_month_year
  ON payroll_records(organisation_id, year, month);

-- Add FK to organisations
ALTER TABLE payroll_records ADD CONSTRAINT payroll_records_organisation_id_fkey
  FOREIGN KEY (organisation_id) REFERENCES organisations(id);

-- Add FK to staff
ALTER TABLE payroll_records ADD CONSTRAINT payroll_records_staff_id_fkey
  FOREIGN KEY (staff_id) REFERENCES staff(id);

-- Add UNIQUE to prevent duplicate payroll for same staff/month/year
CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_unique
  ON payroll_records(organisation_id, staff_id, month, year);

-- Fix status to lowercase default
ALTER TABLE payroll_records ALTER COLUMN status SET DEFAULT 'draft';
UPDATE payroll_records SET status = LOWER(status);

-- ============================================================
-- STEP 20: EXPENSES — add missing FK, deleted_at
-- ============================================================
-- expenses already has organisation_id and created_by — just add missing fields

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS incurred_by  UUID REFERENCES users(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMP;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS updated_by   UUID REFERENCES users(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status       VARCHAR(20) DEFAULT 'pending';

ALTER TABLE expenses ADD CONSTRAINT expenses_organisation_id_fkey
  FOREIGN KEY (organisation_id) REFERENCES organisations(id);

CREATE INDEX IF NOT EXISTS idx_expenses_org_date
  ON expenses(organisation_id, expense_date DESC)
  WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 21: PUSH TOKENS — rename columns, add FK
-- ============================================================

ALTER TABLE push_tokens RENAME COLUMN "userId"    TO user_id;
ALTER TABLE push_tokens RENAME COLUMN "isActive"  TO is_active;
ALTER TABLE push_tokens RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE push_tokens RENAME COLUMN "updatedAt" TO updated_at;

-- Add missing FK to users
ALTER TABLE push_tokens ADD CONSTRAINT push_tokens_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================
-- STEP 22: BUDGETS — add missing updated_by
-- ============================================================

ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_by  UUID REFERENCES users(id);

-- budgets already has organisation_id FK — add it if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'budgets_organisation_id_fkey'
    AND table_name = 'budgets'
  ) THEN
    ALTER TABLE budgets ADD CONSTRAINT budgets_organisation_id_fkey
      FOREIGN KEY (organisation_id) REFERENCES organisations(id);
  END IF;
END $$;

-- ============================================================
-- STEP 23: DROP CLINICS TABLE
-- ============================================================

DROP TABLE IF EXISTS clinics CASCADE;

-- ============================================================
-- STEP 24: CREATE NEW TABLES
-- ============================================================

-- clinic_profiles
CREATE TABLE IF NOT EXISTS clinic_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID UNIQUE NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  clinic_name     VARCHAR(255),
  license_number  VARCHAR(100) UNIQUE,
  gstin           VARCHAR(50),
  specialization  VARCHAR(255),
  bed_count       INT,
  discount_pct    DECIMAL(5,2) DEFAULT 0,
  updated_at      TIMESTAMPTZ
);

-- manufacturer_profiles
CREATE TABLE IF NOT EXISTS manufacturer_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID UNIQUE NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  company_name    VARCHAR(255),
  license_number  VARCHAR(100) UNIQUE,
  gstin           VARCHAR(50) UNIQUE,
  commission_rate DECIMAL(5,2) DEFAULT 0,
  mfg_category    VARCHAR(255),
  updated_at      TIMESTAMPTZ
);

-- organisation_contacts
CREATE TABLE IF NOT EXISTS organisation_contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  type            VARCHAR(20) DEFAULT 'primary'
                  CHECK (type IN ('primary', 'billing', 'shipping')),
  address_line1   TEXT,
  address_line2   TEXT,
  city            VARCHAR(100),
  district        VARCHAR(100),
  state           VARCHAR(100),
  pincode         VARCHAR(10),
  country         VARCHAR(50) DEFAULT 'India',
  phone           VARCHAR(20),
  whatsapp        VARCHAR(20),
  email           VARCHAR(255),
  is_primary      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ
);
CREATE INDEX idx_org_contacts_org ON organisation_contacts(organisation_id);

-- vitals
CREATE TABLE IF NOT EXISTS vitals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  patient_id      UUID NOT NULL REFERENCES patients(id),
  recorded_by     UUID NOT NULL REFERENCES users(id),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  bp              VARCHAR(20),
  temperature     DECIMAL(5,2),
  spo2            DECIMAL(5,2),
  pulse           INT,
  weight          DECIMAL(6,2),
  height          DECIMAL(6,2),
  pain_score      INT CHECK (pain_score >= 0 AND pain_score <= 10),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_vitals_org_patient
  ON vitals(organisation_id, patient_id, recorded_at DESC)
  WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 25: RECORD MIGRATION
-- ============================================================

INSERT INTO migrations (name, executed_at)
VALUES ('012-phase10-schema-restructure', now());

COMMIT;
