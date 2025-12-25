# HMS Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Run Database Migrations

Choose one of these methods:

#### Method A: Using npm script (Recommended)
```bash
npm run migrate:hms
```

#### Method B: Using shell script
```bash
./scripts/run-hms-migrations.sh
```

#### Method C: Using Node.js script
```bash
node scripts/run-hms-migrations.js
```

#### Method D: Manual (using psql)
```bash
# Run all migrations
psql -U your_username -d ayurlahi -f migrations/008-run-all-hms-migrations.sql

# OR run individually
psql -U your_username -d ayurlahi -f migrations/001-create-hms-patients-table.sql
psql -U your_username -d ayurlahi -f migrations/002-create-hms-doctors-table.sql
# ... continue with remaining files
```

### Step 2: Start the Server

```bash
npm run start:dev
```

The server will start on `http://localhost:3000`

### Step 3: Test the API

#### 3.1 Authenticate
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@clinic.com",
    "password": "your_password"
  }'
```

Save the `accessToken` from the response.

#### 3.2 Create a Patient
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
    "phone": "1234567890"
  }'
```

#### 3.3 List Patients
```bash
curl -X GET http://localhost:3000/api/patients?page=1&limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 📋 Complete API Testing Workflow

### 1. Create Patient
```bash
POST /api/patients
```

### 2. Create Doctor
```bash
POST /api/doctors
{
  "doctorId": "DOC001",
  "firstName": "Dr. Jane",
  "lastName": "Smith",
  "specialization": "Cardiology",
  "licenseNumber": "DOC-LIC-001",
  "consultationFee": 500
}
```

### 3. Create Appointment
```bash
POST /api/appointments
{
  "patientId": "<patient-id>",
  "doctorId": "<doctor-id>",
  "appointmentDate": "2025-12-25",
  "appointmentTime": "10:00",
  "duration": 30
}
```

### 4. Create Medical Record
```bash
POST /api/medical-records
{
  "patientId": "<patient-id>",
  "doctorId": "<doctor-id>",
  "appointmentId": "<appointment-id>",
  "visitDate": "2025-12-25",
  "chiefComplaint": "Headache",
  "diagnosis": "Migraine",
  "treatment": "Prescribed medication",
  "vitals": {
    "bloodPressure": "120/80",
    "temperature": 98.6
  }
}
```

### 5. Create Prescription
```bash
POST /api/prescriptions
{
  "patientId": "<patient-id>",
  "doctorId": "<doctor-id>",
  "appointmentId": "<appointment-id>",
  "prescriptionDate": "2025-12-25",
  "diagnosis": "Migraine",
  "items": [
    {
      "medicineName": "Paracetamol",
      "dosage": "500mg",
      "frequency": "2 times a day",
      "duration": "7 days",
      "quantity": 14
    }
  ]
}
```

### 6. Create Lab Report
```bash
POST /api/lab-reports
{
  "reportNumber": "LAB-001",
  "patientId": "<patient-id>",
  "doctorId": "<doctor-id>",
  "appointmentId": "<appointment-id>",
  "orderDate": "2025-12-25",
  "tests": [
    {
      "testName": "Blood Test",
      "testCode": "BT-001"
    }
  ]
}
```

### 7. Create Bill
```bash
POST /api/patient-billing
{
  "billNumber": "BILL-001",
  "patientId": "<patient-id>",
  "appointmentId": "<appointment-id>",
  "billDate": "2025-12-25",
  "items": [
    {
      "itemType": "consultation",
      "itemName": "Consultation Fee",
      "quantity": 1,
      "unitPrice": 500
    }
  ]
}
```

### 8. Record Payment
```bash
POST /api/patient-billing/<bill-id>/payment
{
  "amount": 500,
  "paymentMethod": "cash"
}
```

## ✅ Verification Checklist

After running migrations, verify:

- [ ] All 10 tables created (patients, doctors, appointments, medical_records, prescriptions, prescription_items, lab_reports, lab_tests, patient_bills, bill_items)
- [ ] Server starts without errors
- [ ] Authentication works
- [ ] Can create a patient
- [ ] Can create a doctor
- [ ] Can create an appointment
- [ ] Can create a medical record
- [ ] Can create a prescription
- [ ] Can create a lab report
- [ ] Can create a bill
- [ ] Can record a payment

## 🔍 Troubleshooting

### Migration Errors

**Error: "relation 'clinics' does not exist"**
- Solution: Ensure the `clinics` table exists first

**Error: "type already exists"**
- Solution: This is safe to ignore, or drop existing types first

**Error: "permission denied"**
- Solution: Ensure your database user has CREATE TABLE permissions

### API Errors

**401 Unauthorized**
- Solution: Check your JWT token is valid and included in Authorization header

**403 Forbidden**
- Solution: Ensure your user has the 'clinic' role and is associated with a clinic

**404 Not Found**
- Solution: Check the endpoint URL and ensure the resource exists

**409 Conflict**
- Solution: Check for unique constraint violations (e.g., duplicate patientId, doctorId)

## 📚 Additional Resources

- `HMS_MIGRATION_GUIDE.md` - Detailed migration instructions
- `HMS_IMPLEMENTATION_SUMMARY.md` - Complete implementation details
- `HMS_TEST_SUMMARY.md` - Testing documentation
- `HMS_COMPLETE_SUMMARY.md` - Full project summary

---

**Ready to go!** 🎉



