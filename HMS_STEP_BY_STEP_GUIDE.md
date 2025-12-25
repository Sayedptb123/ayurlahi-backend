# HMS Implementation - Step by Step Execution Guide

## 🎯 Current Status: Ready to Execute Migrations

All code is complete and ready. Follow these steps in order:

---

## Step 1: Verify Prerequisites ✅

### Check Database Connection
```bash
# Test PostgreSQL connection
psql -U your_username -d ayurlahi -c "SELECT version();"
```

### Verify .env File
Make sure your `.env` file has:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=ayurlahi
```

### Verify Clinics Table Exists
```bash
psql -U your_username -d ayurlahi -c "\d clinics"
```
**Important**: The `clinics` table must exist before running HMS migrations.

---

## Step 2: Run Database Migrations ⚠️

### Option A: Single File Migration (Easiest) ⭐ RECOMMENDED

```bash
psql -U your_username -d ayurlahi -f migrations/009-create-all-hms-tables-complete.sql
```

This runs all migrations in one transaction.

### Option B: Using Migration Script

```bash
# Using npm script
npm run migrate:hms

# OR using shell script
./scripts/run-hms-migrations.sh

# OR using Node.js script
node scripts/run-hms-migrations.js
```

### Option C: Run Individual Migrations

```bash
# Run in order:
psql -U your_username -d ayurlahi -f migrations/001-create-hms-patients-table.sql
psql -U your_username -d ayurlahi -f migrations/002-create-hms-doctors-table.sql
psql -U your_username -d ayurlahi -f migrations/003-create-hms-appointments-table.sql
psql -U your_username -d ayurlahi -f migrations/004-create-hms-medical-records-table.sql
psql -U your_username -d ayurlahi -f migrations/005-create-hms-prescriptions-tables.sql
psql -U your_username -d ayurlahi -f migrations/006-create-hms-lab-reports-tables.sql
psql -U your_username -d ayurlahi -f migrations/007-create-hms-patient-billing-tables.sql
```

---

## Step 3: Verify Tables Created ✅

After running migrations, verify:

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

---

## Step 4: Start the Server 🚀

```bash
npm run start:dev
```

The server should start on `http://localhost:3000`

**Watch for**:
- ✅ No database connection errors
- ✅ All modules loaded successfully
- ✅ Server listening on port 3000

---

## Step 5: Test Authentication 🔐

### 5.1 Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@clinic.com",
    "password": "your_password"
  }'
```

**Save the `accessToken` from the response.**

### 5.2 Test Token
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Step 6: Test HMS Endpoints 🧪

### 6.1 Create a Patient

```bash
curl -X POST http://localhost:3000/api/patients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "patientId": "P001",
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1990-01-01",
    "gender": "male",
    "phone": "1234567890",
    "email": "john@example.com"
  }'
```

**Expected**: 201 Created with patient object

### 6.2 List Patients

```bash
curl -X GET "http://localhost:3000/api/patients?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected**: 200 OK with paginated patient list

### 6.3 Create a Doctor

```bash
curl -X POST http://localhost:3000/api/doctors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "doctorId": "DOC001",
    "firstName": "Dr. Jane",
    "lastName": "Smith",
    "specialization": "Cardiology",
    "licenseNumber": "DOC-LIC-001",
    "consultationFee": 500
  }'
```

### 6.4 Create an Appointment

```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "patientId": "<patient-id-from-step-6.1>",
    "doctorId": "<doctor-id-from-step-6.3>",
    "appointmentDate": "2025-12-25",
    "appointmentTime": "10:00",
    "duration": 30,
    "appointmentType": "consultation"
  }'
```

### 6.5 Continue Testing Other Modules

Follow the same pattern for:
- Medical Records
- Prescriptions
- Lab Reports
- Patient Billing

See `HMS_QUICK_START.md` for complete API examples.

---

## Step 7: Verify Data Flow 🔄

### Test Complete Workflow

1. ✅ Create Patient
2. ✅ Create Doctor
3. ✅ Create Appointment (links Patient + Doctor)
4. ✅ Create Medical Record (links to Appointment)
5. ✅ Create Prescription (links to Appointment)
6. ✅ Create Lab Report (links to Appointment)
7. ✅ Create Bill (links to Appointment)
8. ✅ Record Payment

---

## 🐛 Troubleshooting

### Migration Errors

**Error: "relation 'clinics' does not exist"**
```bash
# Solution: Create clinics table first or check it exists
psql -U your_username -d ayurlahi -c "\d clinics"
```

**Error: "type already exists"**
- This is safe to ignore - enum types already exist
- Or drop them first if needed

**Error: "permission denied"**
```bash
# Grant permissions to your user
psql -U postgres -d ayurlahi -c "GRANT ALL PRIVILEGES ON DATABASE ayurlahi TO your_username;"
```

### Server Errors

**Error: "Cannot connect to database"**
- Check `.env` file credentials
- Verify PostgreSQL is running
- Test connection: `psql -U your_username -d ayurlahi`

**Error: "Table does not exist"**
- Run migrations first (Step 2)
- Verify tables were created (Step 3)

**Error: "401 Unauthorized"**
- Check JWT token is valid
- Ensure token is in Authorization header: `Bearer <token>`

**Error: "403 Forbidden"**
- Verify user has 'clinic' role
- Check user is associated with a clinic

---

## ✅ Success Checklist

After completing all steps, verify:

- [ ] All 10 tables created in database
- [ ] Server starts without errors
- [ ] Authentication works
- [ ] Can create patient
- [ ] Can create doctor
- [ ] Can create appointment
- [ ] Can create medical record
- [ ] Can create prescription
- [ ] Can create lab report
- [ ] Can create bill
- [ ] Can record payment
- [ ] Data relationships work correctly

---

## 📚 Reference Documents

- `HMS_QUICK_START.md` - Quick API testing guide
- `HMS_MIGRATION_GUIDE.md` - Detailed migration instructions
- `HMS_IMPLEMENTATION_SUMMARY.md` - Technical details
- `HMS_COMPLETE_SUMMARY.md` - Full project overview

---

## 🎉 Next Steps After Testing

1. **Create Seed Data** - Add sample patients, doctors, etc.
2. **Frontend Integration** - Connect frontend to APIs
3. **API Documentation** - Generate Swagger docs
4. **Performance Testing** - Load testing
5. **Security Audit** - Review access controls

---

**Ready to proceed?** Start with Step 1! 🚀



