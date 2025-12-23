# 🧪 HMS API Testing Guide

## Quick Start Testing

Your HMS system is ready! Here's how to test it:

---

## Step 1: Verify Server is Running

```bash
# Check if server is running
lsof -ti:3000 && echo "Server is running" || echo "Server is not running"

# Or check health endpoint
curl http://localhost:3000/api/health
```

**Expected**: Server should respond

---

## Step 2: Test Authentication

### Login to Get Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your_clinic_email@example.com",
    "password": "your_password"
  }'
```

**Save the `accessToken` from the response!**

### Test Token

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected**: 200 OK with user information

---

## Step 3: Test HMS Endpoints

Replace `YOUR_TOKEN` with the token from Step 2.

### 3.1 Test Patients Endpoint

```bash
# List patients
curl -X GET "http://localhost:3000/api/patients?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 200 OK with patient list (may be empty initially)
```

### 3.2 Test Doctors Endpoint

```bash
# List doctors
curl -X GET "http://localhost:3000/api/doctors?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 200 OK with doctor list (may be empty initially)
```

### 3.3 Test Appointments Endpoint

```bash
# List appointments
curl -X GET "http://localhost:3000/api/appointments?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 200 OK with appointment list (may be empty initially)
```

### 3.4 Test Medical Records Endpoint

```bash
# List medical records
curl -X GET "http://localhost:3000/api/medical-records?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 200 OK with medical records list (may be empty initially)
```

### 3.5 Test Prescriptions Endpoint

```bash
# List prescriptions
curl -X GET "http://localhost:3000/api/prescriptions?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 200 OK with prescriptions list (may be empty initially)
```

### 3.6 Test Lab Reports Endpoint

```bash
# List lab reports
curl -X GET "http://localhost:3000/api/lab-reports?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 200 OK with lab reports list (may be empty initially)
```

### 3.7 Test Patient Billing Endpoint

```bash
# List bills
curl -X GET "http://localhost:3000/api/patient-billing?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 200 OK with bills list (may be empty initially)
```

---

## Step 4: Create Test Data

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
    "email": "john.doe@example.com"
  }'
```

**Save the patient `id` from response!**

### 4.2 Create a Doctor

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

**Save the doctor `id` from response!**

### 4.3 Create an Appointment

```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "PATIENT_ID_FROM_4.1",
    "doctorId": "DOCTOR_ID_FROM_4.2",
    "appointmentDate": "2025-12-25",
    "appointmentTime": "10:00",
    "duration": 30,
    "appointmentType": "consultation",
    "reason": "Regular checkup"
  }'
```

**Save the appointment `id` from response!**

### 4.4 Create a Medical Record

```bash
curl -X POST http://localhost:3000/api/medical-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "PATIENT_ID_FROM_4.1",
    "doctorId": "DOCTOR_ID_FROM_4.2",
    "appointmentId": "APPOINTMENT_ID_FROM_4.3",
    "visitDate": "2025-12-25",
    "chiefComplaint": "Headache and fever",
    "diagnosis": "Viral infection",
    "treatment": "Rest and medication"
  }'
```

### 4.5 Create a Prescription

```bash
curl -X POST http://localhost:3000/api/prescriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "PATIENT_ID_FROM_4.1",
    "doctorId": "DOCTOR_ID_FROM_4.2",
    "appointmentId": "APPOINTMENT_ID_FROM_4.3",
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

### 4.6 Create a Lab Report

```bash
curl -X POST http://localhost:3000/api/lab-reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "PATIENT_ID_FROM_4.1",
    "doctorId": "DOCTOR_ID_FROM_4.2",
    "appointmentId": "APPOINTMENT_ID_FROM_4.3",
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

### 4.7 Create a Bill

```bash
curl -X POST http://localhost:3000/api/patient-billing \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "PATIENT_ID_FROM_4.1",
    "appointmentId": "APPOINTMENT_ID_FROM_4.3",
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

**Save the bill `id` from response!**

### 4.8 Record Payment

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

## Step 5: Verify Data Relationships

### Check Patient Has Appointments

```bash
# Get patient with appointments
curl -X GET "http://localhost:3000/api/patients/PATIENT_ID?include=appointments" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check Doctor Has Appointments

```bash
# Get doctor with appointments
curl -X GET "http://localhost:3000/api/doctors/DOCTOR_ID?include=appointments" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Using Automated Test Scripts

### Option 1: Interactive Test Script

```bash
npm run test:hms
```

This will:
- Prompt for email and password
- Login automatically
- Test all endpoints
- Show results

### Option 2: Health Check

```bash
npm run health:hms
```

This will:
- Check server status
- Verify endpoints are accessible
- Show quick health summary

---

## Expected Responses

### Success (200/201)
```json
{
  "data": [...],
  "total": 0,
  "page": 1,
  "limit": 10,
  "totalPages": 0
}
```

### Unauthorized (401)
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Solution**: Check token is valid, login again

### Forbidden (403)
```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

**Solution**: Verify user has 'clinic' role and is associated with a clinic

### Validation Error (400)
```json
{
  "statusCode": 400,
  "message": ["field should not be empty"],
  "error": "Bad Request"
}
```

**Solution**: Check request body matches DTO requirements

---

## Troubleshooting

### "Server is not running"
```bash
npm run start:dev
```

### "401 Unauthorized"
- Token expired or invalid
- Solution: Login again and get new token

### "403 Forbidden"
- User doesn't have required role
- User not associated with a clinic
- Solution: Check user role and clinic association

### "Table does not exist"
- Migrations not run
- Solution: Run `npm run migrate:hms`

---

## Testing Checklist

- [ ] Server is running
- [ ] Can login and get token
- [ ] GET /api/patients works
- [ ] GET /api/doctors works
- [ ] GET /api/appointments works
- [ ] GET /api/medical-records works
- [ ] GET /api/prescriptions works
- [ ] GET /api/lab-reports works
- [ ] GET /api/patient-billing works
- [ ] Can create patient (POST)
- [ ] Can create doctor (POST)
- [ ] Can create appointment (POST)
- [ ] Can create medical record (POST)
- [ ] Can create prescription (POST)
- [ ] Can create lab report (POST)
- [ ] Can create bill (POST)
- [ ] Can record payment (POST)

---

## Next Steps After Testing

1. ✅ **Create Seed Data** - Add more test data
2. ✅ **Frontend Integration** - Connect frontend to APIs
3. ✅ **API Documentation** - Generate Swagger docs
4. ✅ **Performance Testing** - Load testing
5. ✅ **Security Audit** - Review access controls

---

**Ready to test?** Start with Step 1 above! 🚀

