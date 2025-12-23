# 🎯 HMS Next Steps - Action Plan

**Current Status**: Clinic users need `clinicId` assignment fix

---

## ✅ Immediate Next Step (Do This First)

### Step 1: Fix Clinic Users

Run the one-by-one fix script to assign `clinicId` to at least one clinic user:

```bash
psql -U postgres -d ayurlahi -f scripts/fix-clinic-users-one-by-one.sql
```

**Expected Result**: 
- ✅ `clinic@test.ayurlahi.com` will have clinicId
- ⚠️ `clinic2@test.ayurlahi.com` might fail (that's okay)

**Verify**:
```bash
psql -U postgres -d ayurlahi -c "SELECT email, \"clinicId\" FROM users WHERE role = 'clinic' AND email LIKE '%@test.ayurlahi.com';"
```

---

## 🧪 Testing Roadmap

### Phase 1: Complete CREATE Operations Testing ✅ (In Progress)

**Status**: Admin users work, clinic users need fix

#### 1.1 Test with Clinic User (After Fix)
```bash
npm run test:hms:users
```

This will test:
- ✅ Login as clinic user
- ✅ Create Patient
- ✅ Create Doctor
- ✅ Create Appointment
- ✅ Create Medical Record
- ✅ Create Prescription
- ✅ Create Lab Report
- ✅ Create Bill

#### 1.2 Test with Admin User
```bash
npm run test:hms:all
```

This tests all CREATE operations with admin user.

---

### Phase 2: Test UPDATE Operations ⏳ (Next)

Test PATCH endpoints for all modules:

#### 2.1 Update Patient
```bash
# Update patient details
PATCH /api/patients/:id
```

#### 2.2 Update Doctor
```bash
# Update doctor details
PATCH /api/doctors/:id
```

#### 2.3 Update Appointment
```bash
# Update appointment status/time
PATCH /api/appointments/:id
```

#### 2.4 Update Medical Record
```bash
# Update medical record
PATCH /api/medical-records/:id
```

#### 2.5 Update Prescription
```bash
# Update prescription status
PATCH /api/prescriptions/:id
```

#### 2.6 Update Lab Report
```bash
# Update lab report/test results
PATCH /api/lab-reports/:id
```

#### 2.7 Update Bill
```bash
# Update bill status/amount
PATCH /api/patient-billing/:id
```

**Automated Test**: Create `scripts/test-hms-update-operations.js`

---

### Phase 3: Test DELETE Operations ⏳

Test DELETE endpoints (soft delete where applicable):

#### 3.1 Delete Patient
```bash
DELETE /api/patients/:id
```

#### 3.2 Delete Doctor
```bash
DELETE /api/doctors/:id
```

#### 3.3 Cancel Appointment
```bash
DELETE /api/appointments/:id
```

#### 3.4 Delete Medical Record
```bash
DELETE /api/medical-records/:id
```

#### 3.5 Delete Prescription
```bash
DELETE /api/prescriptions/:id
```

#### 3.6 Delete Lab Report
```bash
DELETE /api/lab-reports/:id
```

#### 3.7 Delete Bill
```bash
DELETE /api/patient-billing/:id
```

**Automated Test**: Create `scripts/test-hms-delete-operations.js`

---

### Phase 4: Create Seed Data Script ⏳

Create comprehensive seed data for testing:

- Multiple patients per clinic
- Multiple doctors per clinic
- Multiple appointments
- Medical records linked to appointments
- Prescriptions with items
- Lab reports with tests
- Bills with items and payments

**Script**: `scripts/seed-hms-data.js`

---

## 📋 Quick Action Checklist

- [ ] **Run clinic users fix script** (`scripts/fix-clinic-users-one-by-one.sql`)
- [ ] **Test clinic user CREATE operations** (`npm run test:hms:users`)
- [ ] **Test admin user CREATE operations** (`npm run test:hms:all`)
- [ ] **Create UPDATE operations test script**
- [ ] **Test all UPDATE operations**
- [ ] **Create DELETE operations test script**
- [ ] **Test all DELETE operations**
- [ ] **Create seed data script**
- [ ] **Run seed data script**

---

## 🚀 Recommended Order

1. **Fix clinic users** (5 min)
2. **Test CREATE operations** (10 min)
3. **Create UPDATE test script** (15 min)
4. **Test UPDATE operations** (10 min)
5. **Create DELETE test script** (15 min)
6. **Test DELETE operations** (10 min)
7. **Create seed data script** (30 min)

**Total Estimated Time**: ~1.5 hours

---

## 📝 Notes

- The unique constraint on `clinicId` means only one user can have a specific clinicId
- This is fine for testing - at least one clinic user will work
- For production, you may want to review this constraint
- All admin operations are working correctly
- All GET endpoints are working correctly

---

**Ready?** Start with Step 1: Fix clinic users! 🎯

