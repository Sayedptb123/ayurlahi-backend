-- Migration: Run All HMS Migrations
-- Description: Master migration file that runs all HMS table creation migrations in order
-- Date: 2025-12-24
-- Usage: psql -U your_username -d ayurlahi -f migrations/008-run-all-hms-migrations.sql

-- Note: This file includes all HMS migrations in the correct order
-- Run this file to create all HMS tables at once

\i migrations/001-create-hms-patients-table.sql
\i migrations/002-create-hms-doctors-table.sql
\i migrations/003-create-hms-appointments-table.sql
\i migrations/004-create-hms-medical-records-table.sql
\i migrations/005-create-hms-prescriptions-tables.sql
\i migrations/006-create-hms-lab-reports-tables.sql
\i migrations/007-create-hms-patient-billing-tables.sql

-- Verify all tables were created
SELECT 
    table_name,
    table_type
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

