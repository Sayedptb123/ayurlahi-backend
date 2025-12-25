# 🧪 HMS Complete Testing Guide

## Overview

Now that test users are created, let's test the complete HMS system end-to-end.

---

## Quick Start Testing

### Option 1: Automated Full Test (Recommended) ⭐

```bash
npm run test:hms:full
```

This script will:
- ✅ Login as clinic user (clinic1@test.com)
- ✅ Test all 7 GET endpoints
- ✅ Create a complete patient workflow:
  - Create patient
  - Create doctor
  - Create appointment
  - Create medical record
  - Create prescription
  - Create lab report
  - Create bill
  - Record payment
- ✅ Show comprehensive results

---

## Test Users Available

All with password: `abc123123`

| Email | Role | Use Case |
|-------|------|----------|
| `admin@test.com` | admin | Full system access |
| `support@test.com` | support | Support features |
| `clinic1@test.com` | clinic | **HMS testing** ⭐ |
| `clinic2@test.com` | clinic | HMS testing (alternative) |
| `manufacturer1@test.com` | manufacturer | Marketplace testing |
| `manufacturer2@test.com` | manufacturer | Marketplace testing |

---

## Manual Testing Steps

### Step 1: Login as Clinic User

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "clinic1@test.com",
    "password": "abc123123"
  }'
```

**Save the `accessToken`!**

### Step 2: Test GET Endpoints

Replace `YOUR_TOKEN` with the token from Step 1.

```bash
# Patients
curl -X GET "http://localhost:3000/api/patients?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Doctors
curl -X GET "http://localhost:3000/api/doctors?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Appointments
curl -X GET "http://localhost:3000/api/appointments?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Medical Records
curl -X GET "http://localhost:3000/api/medical-records?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Prescriptions
curl -X GET "http://localhost:3000/api/prescriptions?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Lab Reports
curl -X GET "http://localhost:3000/api/lab-reports?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Bills
curl -X GET "http://localhost:3000/api/patient-billing?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 3: Create Complete Workflow

#### 3.1 Create Patient

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
    "email": "john.doe@example.com"
  }'
```

**Save the patient `id`!**

#### 3.2 Create Doctor

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
    "consultationFee": 500
  }'
```

**Save the doctor `id`!**

#### 3.3 Create Appointment

```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "PATIENT_ID_HERE",
    "doctorId": "DOCTOR_ID_HERE",
    "appointmentDate": "2025-12-25",
    "appointmentTime": "10:00",
    "duration": 30,
    "appointmentType": "consultation",
    "reason": "Regular checkup"
  }'
```

**Save the appointment `id`!**

#### 3.4 Create Medical Record

```bash
curl -X POST http://localhost:3000/api/medical-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "PATIENT_ID_HERE",
    "doctorId": "DOCTOR_ID_HERE",
    "appointmentId": "APPOINTMENT_ID_HERE",
    "visitDate": "2025-12-25",
    "chiefComplaint": "Headache and fever",
    "diagnosis": "Viral infection",
    "treatment": "Rest and medication"
  }'
```

#### 3.5 Create Prescription

```bash
curl -X POST http://localhost:3000/api/prescriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "PATIENT_ID_HERE",
    "doctorId": "DOCTOR_ID_HERE",
    "appointmentId": "APPOINTMENT_ID_HERE",
    "prescriptionDate": "2025-12-25",
    "diagnosis": "Viral infection",
    "items": [
      {
        "medicineName": "Paracetamol",
        "dosage": "500mg",
        "frequency": "Twice daily",
        "duration": "5 days",
        "quantity": 10
      }
    ]
  }'
```

#### 3.6 Create Lab Report

```bash
curl -X POST http://localhost:3000/api/lab-reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "PATIENT_ID_HERE",
    "doctorId": "DOCTOR_ID_HERE",
    "appointmentId": "APPOINTMENT_ID_HERE",
    "reportNumber": "LAB-001",
    "orderDate": "2025-12-25",
    "tests": [
      {
        "testName": "Complete Blood Count",
        "testCode": "CBC"
      }
    ]
  }'
```

#### 3.7 Create Bill

```bash
curl -X POST http://localhost:3000/api/patient-billing \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "PATIENT_ID_HERE",
    "appointmentId": "APPOINTMENT_ID_HERE",
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

**Save the bill `id`!**

#### 3.8 Record Payment

```bash
curl -X POST "http://localhost:3000/api/patient-billing/BILL_ID_HERE/payment" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "amount": 500,
    "paymentMethod": "cash"
  }'
```

---

## Testing Checklist

### Authentication ✅
- [ ] Can login with clinic1@test.com
- [ ] Can login with clinic2@test.com
- [ ] Token is valid
- [ ] GET /api/auth/me works

### GET Endpoints ✅
- [ ] GET /api/patients returns 200
- [ ] GET /api/doctors returns 200
- [ ] GET /api/appointments returns 200
- [ ] GET /api/medical-records returns 200
- [ ] GET /api/prescriptions returns 200
- [ ] GET /api/lab-reports returns 200
- [ ] GET /api/patient-billing returns 200

### CREATE Operations ✅
- [ ] Can create patient
- [ ] Can create doctor
- [ ] Can create appointment
- [ ] Can create medical record
- [ ] Can create prescription
- [ ] Can create lab report
- [ ] Can create bill
- [ ] Can record payment

### Data Relationships ✅
- [ ] Patient has appointments
- [ ] Doctor has appointments
- [ ] Appointment links to patient and doctor
- [ ] Medical record links to appointment
- [ ] Prescription links to appointment
- [ ] Lab report links to appointment
- [ ] Bill links to appointment

### Search & Filter ✅
- [ ] Can search patients
- [ ] Can filter appointments by date
- [ ] Can filter by status
- [ ] Pagination works

---

## Available Test Commands

```bash
# Full automated test
npm run test:hms:full

# Interactive endpoint testing
npm run test:hms

# Interactive CREATE testing
npm run test:hms:create

# Health check
npm run health:hms
```

---

## Expected Results

After running `npm run test:hms:full`, you should see:

```
✓ GET /api/patients - Status: 200
✓ GET /api/doctors - Status: 200
✓ GET /api/appointments - Status: 200
✓ GET /api/medical-records - Status: 200
✓ GET /api/prescriptions - Status: 200
✓ GET /api/lab-reports - Status: 200
✓ GET /api/patient-billing - Status: 200

✓ POST /api/patients - Create Patient - Status: 201
✓ POST /api/doctors - Create Doctor - Status: 201
✓ POST /api/appointments - Create Appointment - Status: 201
✓ POST /api/medical-records - Create Medical Record - Status: 201
✓ POST /api/prescriptions - Create Prescription - Status: 201
✓ POST /api/lab-reports - Create Lab Report - Status: 201
✓ POST /api/patient-billing - Create Bill - Status: 201
✓ POST /api/patient-billing/:id/payment - Record Payment - Status: 200

🎉 All tests passed! HMS is working correctly!
```

---

## Troubleshooting

### "401 Unauthorized"
- Check token is valid
- Re-login to get new token
- Verify user has 'clinic' role

### "403 Forbidden"
- User not associated with a clinic
- Check user.clinicId is set
- Verify clinic exists

### "500 Internal Server Error"
- Check server logs
- Verify database connection
- Check if migrations ran

### "Cannot create patient/doctor"
- Verify clinicId is set for user
- Check database schema matches entity
- Run migration if needed: `npm run migrate:fix-users`

---

## Next Steps After Testing

1. ✅ **Verify all endpoints work**
2. ✅ **Create more test data**
3. ✅ **Test edge cases**
4. ✅ **Test error handling**
5. ✅ **Performance testing**
6. ✅ **Frontend integration**

---

**Ready to test?** Run `npm run test:hms:full` to get started! 🚀



