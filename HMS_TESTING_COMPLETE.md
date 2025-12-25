# 🧪 HMS Testing Guide

## Quick Testing Options

You have **3 ways** to test the HMS APIs:

---

## Option 1: Automated Test Script (Recommended) ⭐

Run the automated test script:

```bash
npm run test:hms
```

**What it does:**
- Checks if server is running
- Logs you in automatically
- Tests all 7 HMS GET endpoints
- Shows pass/fail results
- Provides summary

---

## Option 2: Manual curl Commands

### Step 1: Login and Get Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your_email@example.com",
    "password": "your_password"
  }'
```

**Save the `accessToken` from the response!**

### Step 2: Test Each Endpoint

Replace `YOUR_TOKEN` with the token from Step 1.

```bash
# Patients
curl -X GET "http://localhost:3000/api/patients?page=1&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Doctors
curl -X GET "http://localhost:3000/api/doctors?page=1&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Appointments
curl -X GET "http://localhost:3000/api/appointments?page=1&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Medical Records
curl -X GET "http://localhost:3000/api/medical-records?page=1&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Prescriptions
curl -X GET "http://localhost:3000/api/prescriptions?page=1&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Lab Reports
curl -X GET "http://localhost:3000/api/lab-reports?page=1&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Patient Billing
curl -X GET "http://localhost:3000/api/patient-billing?page=1&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Option 3: Using Postman or Insomnia

### Import Collection

1. Create a new collection: "HMS APIs"
2. Set base URL: `http://localhost:3000`
3. Add environment variable: `token`

### Create Requests

**1. Login (POST)**
- URL: `{{baseUrl}}/api/auth/login`
- Method: POST
- Body (JSON):
  ```json
  {
    "email": "your_email@example.com",
    "password": "your_password"
  }
  ```
- Save `accessToken` to environment variable `token`

**2. Get Patients (GET)**
- URL: `{{baseUrl}}/api/patients?page=1&limit=10`
- Method: GET
- Headers: `Authorization: Bearer {{token}}`

**3. Get Doctors (GET)**
- URL: `{{baseUrl}}/api/doctors?page=1&limit=10`
- Method: GET
- Headers: `Authorization: Bearer {{token}}`

**4. Get Appointments (GET)**
- URL: `{{baseUrl}}/api/appointments?page=1&limit=10`
- Method: GET
- Headers: `Authorization: Bearer {{token}}`

**5. Get Medical Records (GET)**
- URL: `{{baseUrl}}/api/medical-records?page=1&limit=10`
- Method: GET
- Headers: `Authorization: Bearer {{token}}`

**6. Get Prescriptions (GET)**
- URL: `{{baseUrl}}/api/prescriptions?page=1&limit=10`
- Method: GET
- Headers: `Authorization: Bearer {{token}}`

**7. Get Lab Reports (GET)**
- URL: `{{baseUrl}}/api/lab-reports?page=1&limit=10`
- Method: GET
- Headers: `Authorization: Bearer {{token}}`

**8. Get Bills (GET)**
- URL: `{{baseUrl}}/api/patient-billing?page=1&limit=10`
- Method: GET
- Headers: `Authorization: Bearer {{token}}`

---

## Testing CREATE Operations

### Create a Patient

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

### Create a Doctor

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

### Create an Appointment

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
    "appointmentType": "consultation"
  }'
```

**For more examples**, see `HMS_POST_MIGRATION_CHECKLIST.md`

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

**Solution**: Check your token is valid, login again

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
# Start the server
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

### "Connection refused"
- Database not running
- Solution: Start PostgreSQL

---

## Complete Testing Checklist

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

1. ✅ **Create Seed Data** - Add sample data for testing
2. ✅ **Frontend Integration** - Connect frontend to APIs
3. ✅ **API Documentation** - Generate Swagger/OpenAPI docs
4. ✅ **Performance Testing** - Load testing
5. ✅ **Security Audit** - Review access controls

---

## Reference Documents

- **Post-Migration Checklist**: `HMS_POST_MIGRATION_CHECKLIST.md`
- **Quick Start**: `HMS_QUICK_START.md`
- **Step-by-Step Guide**: `HMS_STEP_BY_STEP_GUIDE.md`

---

**Ready to test?** Run `npm run test:hms` to get started! 🚀



