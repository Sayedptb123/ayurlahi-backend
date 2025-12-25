# HMS Database Migration Guide

## Overview

This guide explains how to run the database migrations for all HMS (Hospital Management System) modules.

## Migration Files

The following migration files have been created:

1. **001-create-hms-patients-table.sql** - Creates patients table
2. **002-create-hms-doctors-table.sql** - Creates doctors table
3. **003-create-hms-appointments-table.sql** - Creates appointments table
4. **004-create-hms-medical-records-table.sql** - Creates medical_records table
5. **005-create-hms-prescriptions-tables.sql** - Creates prescriptions and prescription_items tables
6. **006-create-hms-lab-reports-tables.sql** - Creates lab_reports and lab_tests tables
7. **007-create-hms-patient-billing-tables.sql** - Creates patient_bills and bill_items tables
8. **008-run-all-hms-migrations.sql** - Master file to run all migrations

## Prerequisites

1. PostgreSQL database must be running
2. Database must exist (check your `.env` file for `DB_NAME`)
3. User must have CREATE TABLE and ALTER TABLE permissions
4. Existing `clinics` table must exist (for foreign key constraints)

## Running Migrations

### Option 1: Run All Migrations at Once (Recommended)

```bash
cd /Users/sayedsuhail/ayurlahi-backend
psql -U your_username -d ayurlahi -f migrations/008-run-all-hms-migrations.sql
```

**Note:** If using `\i` commands doesn't work, run each migration file individually (see Option 2).

### Option 2: Run Migrations Individually

Run each migration file in order:

```bash
# 1. Patients
psql -U your_username -d ayurlahi -f migrations/001-create-hms-patients-table.sql

# 2. Doctors
psql -U your_username -d ayurlahi -f migrations/002-create-hms-doctors-table.sql

# 3. Appointments
psql -U your_username -d ayurlahi -f migrations/003-create-hms-appointments-table.sql

# 4. Medical Records
psql -U your_username -d ayurlahi -f migrations/004-create-hms-medical-records-table.sql

# 5. Prescriptions
psql -U your_username -d ayurlahi -f migrations/005-create-hms-prescriptions-tables.sql

# 6. Lab Reports
psql -U your_username -d ayurlahi -f migrations/006-create-hms-lab-reports-tables.sql

# 7. Patient Billing
psql -U your_username -d ayurlahi -f migrations/007-create-hms-patient-billing-tables.sql
```

### Option 3: Using pgAdmin or GUI Tool

1. Open pgAdmin (or your preferred PostgreSQL GUI)
2. Connect to your database
3. Right-click on your database → Query Tool
4. Open each migration file one by one
5. Execute each file (F5 or Execute button)

### Option 4: Copy and Paste SQL

1. Open each migration file
2. Copy the SQL content
3. Paste into your PostgreSQL client
4. Execute

## Finding Your Database Credentials

Check your `.env` file:

```bash
DB_USERNAME=postgres          # Your PostgreSQL username
DB_NAME=ayurlahi              # Your database name
DB_HOST=localhost             # Usually localhost
DB_PORT=5432                  # Usually 5432
```

## Verification

After running migrations, verify tables were created:

```bash
psql -U your_username -d ayurlahi -c "\dt"
```

Or using SQL:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
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
ORDER BY table_name;
```

## Expected Tables

After successful migration, you should have:

1. ✅ `patients` - Patient information
2. ✅ `doctors` - Doctor information
3. ✅ `appointments` - Appointment scheduling
4. ✅ `medical_records` - Medical visit records
5. ✅ `prescriptions` - Prescription headers
6. ✅ `prescription_items` - Prescription medicine items
7. ✅ `lab_reports` - Lab report headers
8. ✅ `lab_tests` - Individual lab tests
9. ✅ `patient_bills` - Patient billing headers
10. ✅ `bill_items` - Bill line items

## Troubleshooting

### Error: "relation 'clinics' does not exist"
- **Solution**: Make sure the `clinics` table exists first. This is a dependency for all HMS tables.

### Error: "type already exists"
- **Solution**: The enum types might already exist. You can safely ignore this or drop them first:
  ```sql
  DROP TYPE IF EXISTS appointment_status CASCADE;
  DROP TYPE IF EXISTS appointment_type CASCADE;
  DROP TYPE IF EXISTS prescription_status CASCADE;
  DROP TYPE IF EXISTS lab_report_status CASCADE;
  DROP TYPE IF EXISTS lab_test_status CASCADE;
  DROP TYPE IF EXISTS bill_status CASCADE;
  DROP TYPE IF EXISTS payment_method CASCADE;
  DROP TYPE IF EXISTS bill_item_type CASCADE;
  ```

### Error: "table already exists"
- **Solution**: If tables already exist, you can either:
  1. Drop them first: `DROP TABLE IF EXISTS table_name CASCADE;`
  2. Use `CREATE TABLE IF NOT EXISTS` (already included in migrations)

### Error: "permission denied"
- **Solution**: Make sure your database user has CREATE TABLE and ALTER TABLE permissions.

## Rollback (If Needed)

To rollback migrations, drop tables in reverse order:

```sql
DROP TABLE IF EXISTS "bill_items" CASCADE;
DROP TABLE IF EXISTS "patient_bills" CASCADE;
DROP TABLE IF EXISTS "lab_tests" CASCADE;
DROP TABLE IF EXISTS "lab_reports" CASCADE;
DROP TABLE IF EXISTS "prescription_items" CASCADE;
DROP TABLE IF EXISTS "prescriptions" CASCADE;
DROP TABLE IF EXISTS "medical_records" CASCADE;
DROP TABLE IF EXISTS "appointments" CASCADE;
DROP TABLE IF EXISTS "doctors" CASCADE;
DROP TABLE IF EXISTS "patients" CASCADE;

-- Drop enum types if needed
DROP TYPE IF EXISTS bill_item_type CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS bill_status CASCADE;
DROP TYPE IF EXISTS lab_test_status CASCADE;
DROP TYPE IF EXISTS lab_report_status CASCADE;
DROP TYPE IF EXISTS prescription_status CASCADE;
DROP TYPE IF EXISTS appointment_type CASCADE;
DROP TYPE IF EXISTS appointment_status CASCADE;
```

## Next Steps

After running migrations:

1. ✅ Verify all tables were created
2. ✅ Test API endpoints
3. ✅ Create test data
4. ✅ Run automated tests

## Support

If you encounter issues:
1. Check PostgreSQL logs
2. Verify database connection
3. Ensure all dependencies exist
4. Check foreign key constraints

---

**Migration Date**: December 24, 2025
**Status**: Ready to Execute



