# 🧪 HMS Comprehensive Testing Plan

**Status**: ✅ Test Users Created  
**Date**: December 24, 2025

---

## ✅ What's Ready

- ✅ All 7 HMS modules implemented
- ✅ All admin user fixes applied
- ✅ Test users created (7 users across all roles)
- ✅ GET endpoints tested and working
- ✅ Patient/Doctor creation tested

---

## 🎯 Next Steps - Testing Roadmap

### Phase 1: Test All CREATE Operations ⏳

Test creating records with different user types:

#### 1.1 Test with Clinic User
```bash
# Login as clinic user
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "clinic@test.ayurlahi.com",
    "password": "Clinic@123"
  }'

# Save the token, then test:
# - Create Patient (no clinicId needed)
# - Create Doctor (no clinicId needed)
# - Create Appointment
# - Create Medical Record
# - Create Prescription
# - Create Lab Report
# - Create Bill
# - Record Payment
```

#### 1.2 Test with Admin User
```bash
# Login as admin user
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.ayurlahi.com",
    "password": "Admin@123"
  }'

# Test creating records for different clinics
# - Get clinic ID first: GET /api/clinics
# - Create Patient with clinicId
# - Create Doctor with clinicId
# - Create Appointment (uses patient's clinicId)
```

---

### Phase 2: Test UPDATE Operations ⏳

Test updating existing records:

```bash
# Update Patient
curl -X PATCH http://localhost:3000/api/patients/PATIENT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"phone": "9876543210"}'

# Update Doctor
curl -X PATCH http://localhost:3000/api/doctors/DOCTOR_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"consultationFee": 600}'

# Update Appointment Status
curl -X PATCH http://localhost:3000/api/appointments/APPOINTMENT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"status": "confirmed"}'
```

---

### Phase 3: Test DELETE Operations ⏳

Test deleting records (be careful - permanent):

```bash
# Delete Appointment
curl -X DELETE http://localhost:3000/api/appointments/APPOINTMENT_ID \
  -H "Authorization: Bearer TOKEN"

# Delete Patient (cascade will delete related records)
curl -X DELETE http://localhost:3000/api/patients/PATIENT_ID \
  -H "Authorization: Bearer TOKEN"
```

---

### Phase 4: Test Multi-Tenancy ⏳

Verify data isolation:

1. **Login as clinic@test.ayurlahi.com**
   - Create some patients, doctors, appointments
   - Note the IDs

2. **Login as clinic2@test.ayurlahi.com**
   - Verify you can't see clinic1's data
   - Create your own data
   - Verify isolation

3. **Login as admin@test.ayurlahi.com**
   - Verify you can see data from both clinics
   - Test creating records for different clinics

---

### Phase 5: Test Search and Filtering ⏳

```bash
# Search patients
curl "http://localhost:3000/api/patients?search=John" \
  -H "Authorization: Bearer TOKEN"

# Filter appointments by date
curl "http://localhost:3000/api/appointments?startDate=2025-12-01&endDate=2025-12-31" \
  -H "Authorization: Bearer TOKEN"

# Filter by status
curl "http://localhost:3000/api/appointments?status=scheduled" \
  -H "Authorization: Bearer TOKEN"

# Filter by patient
curl "http://localhost:3000/api/appointments?patientId=PATIENT_ID" \
  -H "Authorization: Bearer TOKEN"

# Filter by doctor
curl "http://localhost:3000/api/appointments?doctorId=DOCTOR_ID" \
  -H "Authorization: Bearer TOKEN"
```

---

### Phase 6: Test Complete Workflows ⏳

#### Workflow 1: Patient Visit
1. Create Patient
2. Create Doctor
3. Create Appointment
4. Create Medical Record (linked to appointment)
5. Create Prescription (linked to appointment)
6. Create Lab Report (linked to appointment)
7. Create Bill (linked to appointment)
8. Record Payment

#### Workflow 2: Follow-up Visit
1. Get existing Patient
2. Get existing Doctor
3. Create new Appointment
4. Create Medical Record
5. Update Prescription (if needed)
6. Create new Bill
7. Record Payment

---

## 🧪 Automated Testing

### Option 1: Use Comprehensive Test Script
```bash
npm run test:hms:all
```

This tests:
- All CREATE operations
- UPDATE operations
- Shows results

### Option 2: Use Individual Test Scripts
```bash
# Test GET endpoints
npm run test:hms

# Test CREATE operations
npm run test:hms:create

# Test all operations
npm run test:hms:all
```

---

## 📋 Testing Checklist

### CREATE Operations
- [ ] Create Patient (clinic user)
- [ ] Create Patient (admin user with clinicId)
- [ ] Create Doctor (clinic user)
- [ ] Create Doctor (admin user with clinicId)
- [ ] Create Appointment
- [ ] Create Medical Record
- [ ] Create Prescription (with items)
- [ ] Create Lab Report (with tests)
- [ ] Create Bill (with items)
- [ ] Record Payment

### UPDATE Operations
- [ ] Update Patient
- [ ] Update Doctor
- [ ] Update Appointment
- [ ] Update Medical Record
- [ ] Update Prescription
- [ ] Update Lab Report
- [ ] Update Bill

### DELETE Operations
- [ ] Delete Appointment
- [ ] Delete Medical Record
- [ ] Delete Prescription
- [ ] Delete Lab Report
- [ ] Delete Bill
- [ ] Delete Patient (cascade test)
- [ ] Delete Doctor (cascade test)

### Multi-Tenancy
- [ ] Clinic user can only see their data
- [ ] Admin user can see all data
- [ ] Data isolation works correctly

### Search & Filtering
- [ ] Search patients by name
- [ ] Filter appointments by date
- [ ] Filter appointments by status
- [ ] Filter appointments by patient
- [ ] Filter appointments by doctor

### Relationships
- [ ] Patient → Appointments
- [ ] Doctor → Appointments
- [ ] Appointment → Medical Records
- [ ] Appointment → Prescriptions
- [ ] Appointment → Lab Reports
- [ ] Appointment → Bills

---

## 🎯 Recommended Testing Order

1. **Quick Test** (5 minutes)
   ```bash
   npm run test:hms:all
   ```
   - Verifies all CREATE operations work
   - Quick sanity check

2. **Role-Based Testing** (15 minutes)
   - Test with clinic user
   - Test with admin user
   - Verify different behaviors

3. **Complete Workflow** (20 minutes)
   - Test full patient visit workflow
   - Verify all relationships work

4. **Edge Cases** (15 minutes)
   - Test error cases
   - Test validation
   - Test permissions

---

## 📊 Test Results Template

After testing, document results:

```markdown
## Test Results - [Date]

### CREATE Operations
- ✅ Patient creation - Working
- ✅ Doctor creation - Working
- ✅ Appointment creation - Working
- ...

### Issues Found
- [ ] Issue 1: Description
- [ ] Issue 2: Description

### Notes
- ...
```

---

## 🚀 Quick Start Testing

**Right now, do this:**

1. **Test with clinic user:**
   ```bash
   # Login
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "clinic@test.ayurlahi.com", "password": "Clinic@123"}'
   
   # Save token, then create a patient
   curl -X POST http://localhost:3000/api/patients \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer TOKEN" \
     -d '{
       "patientId": "P001",
       "firstName": "Test",
       "lastName": "Patient"
     }'
   ```

2. **Or use automated script:**
   ```bash
   npm run test:hms:all
   ```

---

## 📚 Reference Documents

- **Test Users**: `HMS_TEST_USERS.md` - All credentials
- **Quick Reference**: `HMS_TEST_USERS_QUICK_REFERENCE.md`
- **Testing Guide**: `HMS_TESTING_GUIDE.md` - Detailed curl commands
- **Next Steps**: `HMS_NEXT_STEPS_ROADMAP.md` - Complete roadmap

---

**Status**: ✅ **READY FOR COMPREHENSIVE TESTING**

**Next Action**: Run `npm run test:hms:all` or follow the testing phases above!

