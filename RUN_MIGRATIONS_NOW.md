# 🚀 Run HMS Migrations Now

## Quick Start

You have **3 options** to run the migrations:

---

## Option 1: Using npm Script (Recommended) ⭐

This script reads from your `.env` file automatically:

```bash
npm run migrate:hms
```

**What it does:**
- Reads database credentials from `.env`
- Prompts for password if needed
- Runs all 7 migration files in order
- Verifies tables were created

---

## Option 2: Single File Migration (Fastest)

Run the complete migration file in one go:

```bash
psql -U your_username -d ayurlahi -f migrations/009-create-all-hms-tables-complete.sql
```

**Replace `your_username` with your PostgreSQL username.**

**If you need a password:**
```bash
PGPASSWORD=your_password psql -U your_username -d ayurlahi -f migrations/009-create-all-hms-tables-complete.sql
```

---

## Option 3: Manual Step-by-Step

Run each migration file individually:

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

---

## Prerequisites Check

Before running migrations, ensure:

1. **PostgreSQL is running**
   ```bash
   # Check if PostgreSQL is running
   pg_isready
   ```

2. **Database exists**
   ```bash
   psql -U your_username -l | grep ayurlahi
   ```

3. **Clinics table exists** (required dependency)
   ```bash
   psql -U your_username -d ayurlahi -c "\d clinics"
   ```

---

## After Running Migrations

### Verify Tables Created

```bash
psql -U your_username -d ayurlahi -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'patients', 'doctors', 'appointments', 'medical_records',
    'prescriptions', 'prescription_items', 'lab_reports', 'lab_tests',
    'patient_bills', 'bill_items'
  )
ORDER BY table_name;
"
```

**Expected**: 10 tables should be listed

### Start the Server

```bash
npm run start:dev
```

---

## Troubleshooting

### "relation 'clinics' does not exist"
- **Solution**: Create the clinics table first or ensure it exists
- This is a dependency for all HMS tables

### "permission denied"
- **Solution**: Grant permissions:
  ```sql
  GRANT ALL PRIVILEGES ON DATABASE ayurlahi TO your_username;
  ```

### "type already exists"
- **Solution**: Safe to ignore - enum types already exist
- The migration uses `IF NOT EXISTS` for safety

### Connection refused
- **Solution**: Ensure PostgreSQL is running:
  ```bash
  # macOS
  brew services start postgresql@14
  
  # Linux
  sudo systemctl start postgresql
  ```

---

## Next Steps After Migrations

1. ✅ Verify all 10 tables created
2. ✅ Start server: `npm run start:dev`
3. ✅ Test authentication
4. ✅ Test HMS API endpoints
5. ✅ Create test data

See `HMS_STEP_BY_STEP_GUIDE.md` for detailed testing instructions.

---

**Ready?** Choose an option above and run the migrations! 🚀



