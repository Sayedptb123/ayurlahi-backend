# ✅ HMS Post-Migration Checklist

## 🎉 Congratulations! Migrations Complete

You've successfully run the HMS migrations. Now let's verify everything is working.

---

## Step 1: Verify Database Tables ✅

Run this command to verify all 10 tables were created:

```bash
psql -U postgres -d ayurlahi -c "
SELECT 
    table_name,
    '✓' as status
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
"
```

**Expected Output**: 10 rows showing all tables

### Quick Check
```bash
psql -U postgres -d ayurlahi -c "\dt" | grep -E "(patients|doctors|appointments|medical_records|prescriptions|lab_reports|patient_bills)"
```

---

## Step 2: Verify Server Status ✅

Your server is **running on port 3000** ✓

### Check Server Health
```bash
curl http://localhost:3000/api/health
```

Or visit in browser: `http://localhost:3000/api/health`

---

## Step 3: Test Authentication 🔐

### 3.1 Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your_clinic_email@example.com",
    "password": "your_password"
  }'
```

**Save the `accessToken` from the response!**

### 3.2 Test Token
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected**: 200 OK with user information

---

## Step 4: Test HMS API Endpoints 🧪

### 4.1 Create a Patient

```bash
curl -X POST http://localhost:3000/api/patients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "P001",
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1990-01-01",
    "gender": "male",
    "phone": "1234567890",
    "email": "john.doe@example.com",
    "address": {
      "street": "123 Main St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "zipCode": "400001"
    }
  }'
```

**Expected**: 201 Created with patient object

**Save the patient `id` from response!**

### 4.2 List Patients

```bash
curl -X GET "http://localhost:3000/api/patients?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected**: 200 OK with paginated patient list

### 4.3 Get Patient by ID

```bash
curl -X GET "http://localhost:3000/api/patients/PATIENT_ID_HERE" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 4.4 Create a Doctor

```bash
curl -X POST http://localhost:3000/api/doctors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "doctorId": "DOC001",
    "firstName": "Dr. Jane",
    "lastName": "Smith",
    "specialization": "Cardiology",
    "licenseNumber": "DOC-LIC-001",
    "consultationFee": 500,
    "phone": "9876543210",
    "email": "jane.smith@clinic.com"
  }'
```

**Expected**: 201 Created with doctor object

**Save the doctor `id` from response!**

### 4.5 List Doctors

```bash
curl -X GET "http://localhost:3000/api/doctors?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 4.6 Create an Appointment

```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "PATIENT_ID_FROM_4.1",
    "doctorId": "DOCTOR_ID_FROM_4.4",
    "appointmentDate": "2025-12-25",
    "appointmentTime": "10:00",
    "duration": 30,
    "appointmentType": "consultation",
    "reason": "Regular checkup"
  }'
```

**Expected**: 201 Created with appointment object

**Save the appointment `id` from response!**

---

### 4.7 Create a Medical Record

```bash
curl -X POST http://localhost:3000/api/medical-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "PATIENT_ID_FROM_4.1",
    "doctorId": "DOCTOR_ID_FROM_4.4",
    "appointmentId": "APPOINTMENT_ID_FROM_4.6",
    "visitDate": "2025-12-25",
    "chiefComplaint": "Headache and fever",
    "diagnosis": "Viral infection",
    "treatment": "Rest and medication",
    "vitals": {
      "temperature": "99.5°F",
      "bloodPressure": "120/80",
      "pulse": "72 bpm"
    }
  }'
```

**Expected**: 201 Created with medical record object

---

### 4.8 Create a Prescription

```bash
curl -X POST http://localhost:3000/api/prescriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "PATIENT_ID_FROM_4.1",
    "doctorId": "DOCTOR_ID_FROM_4.4",
    "appointmentId": "APPOINTMENT_ID_FROM_4.6",
    "prescriptionDate": "2025-12-25",
    "diagnosis": "Viral infection",
    "items": [
      {
        "medicineName": "Paracetamol",
        "dosage": "500mg",
        "frequency": "Twice daily",
        "duration": "5 days",
        "quantity": 10,
        "instructions": "Take after meals"
      }
    ]
  }'
```

**Expected**: 201 Created with prescription object

---

### 4.9 Create a Lab Report

```bash
curl -X POST http://localhost:3000/api/lab-reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "PATIENT_ID_FROM_4.1",
    "doctorId": "DOCTOR_ID_FROM_4.4",
    "appointmentId": "APPOINTMENT_ID_FROM_4.6",
    "reportNumber": "LAB-001",
    "orderDate": "2025-12-25",
    "tests": [
      {
        "testName": "Complete Blood Count",
        "testCode": "CBC",
        "normalRange": "4.5-11.0",
        "unit": "x10^9/L"
      }
    ]
  }'
```

**Expected**: 201 Created with lab report object

---

### 4.10 Create a Patient Bill

```bash
curl -X POST http://localhost:3000/api/patient-billing \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "PATIENT_ID_FROM_4.1",
    "appointmentId": "APPOINTMENT_ID_FROM_4.6",
    "billNumber": "BILL-001",
    "billDate": "2025-12-25",
    "items": [
      {
        "itemType": "consultation",
        "itemName": "Consultation Fee",
        "quantity": 1,
        "unitPrice": 500,
        "discount": 0
      }
    ],
    "discount": 0,
    "tax": 0
  }'
```

**Expected**: 201 Created with bill object

**Save the bill `id` from response!**

---

### 4.11 Record Payment

```bash
curl -X POST "http://localhost:3000/api/patient-billing/BILL_ID_HERE/payment" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "amount": 500,
    "paymentMethod": "cash"
  }'
```

**Expected**: 200 OK with updated bill

---

## Step 5: Verify Data Relationships 🔗

### Check Foreign Keys

```bash
# Verify patient has appointments
psql -U postgres -d ayurlahi -c "
SELECT p.\"firstName\", p.\"lastName\", COUNT(a.id) as appointment_count
FROM patients p
LEFT JOIN appointments a ON a.\"patientId\" = p.id
GROUP BY p.id, p.\"firstName\", p.\"lastName\"
LIMIT 5;
"

# Verify doctor has appointments
psql -U postgres -d ayurlahi -c "
SELECT d.\"firstName\", d.\"lastName\", COUNT(a.id) as appointment_count
FROM doctors d
LEFT JOIN appointments a ON a.\"doctorId\" = d.id
GROUP BY d.id, d.\"firstName\", d.\"lastName\"
LIMIT 5;
"
```

---

## Step 6: Test Search and Filtering 🔍

### Search Patients
```bash
curl -X GET "http://localhost:3000/api/patients?search=John&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Filter Appointments by Date
```bash
curl -X GET "http://localhost:3000/api/appointments?startDate=2025-12-01&endDate=2025-12-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Filter by Status
```bash
curl -X GET "http://localhost:3000/api/appointments?status=scheduled" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ✅ Success Checklist

After testing, verify:

- [ ] All 10 database tables exist
- [ ] Server is running on port 3000
- [ ] Authentication works (login + token)
- [ ] Can create patient
- [ ] Can create doctor
- [ ] Can create appointment
- [ ] Can create medical record
- [ ] Can create prescription
- [ ] Can create lab report
- [ ] Can create bill
- [ ] Can record payment
- [ ] Data relationships work (foreign keys)
- [ ] Search and filtering work
- [ ] Pagination works

---

## 🐛 Troubleshooting

### "Table does not exist"
- **Solution**: Re-run migrations
- **Check**: `psql -U postgres -d ayurlahi -c "\dt"`

### "401 Unauthorized"
- **Solution**: Check JWT token is valid
- **Fix**: Login again and get new token

### "403 Forbidden"
- **Solution**: Verify user has 'clinic' role
- **Check**: User must be associated with a clinic

### "Foreign key constraint fails"
- **Solution**: Ensure parent records exist
- **Example**: Create patient before creating appointment

### "Duplicate key violation"
- **Solution**: Use unique IDs
- **Example**: `patientId` must be unique within clinic

---

## 📊 Expected Database State

After successful testing, you should have:

- **1+ patients** in `patients` table
- **1+ doctors** in `doctors` table
- **1+ appointments** in `appointments` table
- **1+ medical records** in `medical_records` table
- **1+ prescriptions** in `prescriptions` table
- **1+ lab reports** in `lab_reports` table
- **1+ bills** in `patient_bills` table

---

## 🎉 Next Steps

1. ✅ **Create Seed Data** - Add more test data
2. ✅ **Frontend Integration** - Connect frontend to APIs
3. ✅ **API Documentation** - Generate Swagger docs
4. ✅ **Performance Testing** - Load testing
5. ✅ **Security Audit** - Review access controls

---

## 📚 Reference

- **Quick Start**: `HMS_QUICK_START.md`
- **Step-by-Step Guide**: `HMS_STEP_BY_STEP_GUIDE.md`
- **API Examples**: See above or `HMS_QUICK_START.md`

---

**Status**: ✅ **MIGRATIONS COMPLETE - READY FOR TESTING**

**Date**: December 24, 2025

**Next Action**: Test all API endpoints using the commands above! 🚀

