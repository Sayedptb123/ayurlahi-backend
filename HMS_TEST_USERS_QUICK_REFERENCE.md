# 🧪 HMS Test Users - Quick Reference

## 🚀 Quick Start

### Create Test Users

```bash
npm run seed:test-users
```

Or use SQL directly:
```bash
psql -U your_username -d ayurlahi -f scripts/seed-test-users.sql
```

---

## 📋 All Test Users

### 👑 Admin Users

| Email | Password | Use Case |
|-------|----------|----------|
| admin@test.ayurlahi.com | Admin@123 | Full system access, can create records for any clinic |
| admin2@test.ayurlahi.com | Admin@123 | Backup admin account |

**Testing:**
- Create patients/doctors for any clinic (specify `clinicId`)
- View all clinics
- Manage all data across all clinics

---

### 🛟 Support Users

| Email | Password | Use Case |
|-------|----------|----------|
| support@test.ayurlahi.com | Support@123 | Support operations, view all clinics |

**Testing:**
- View all clinics
- View all data (read operations)
- Support-specific operations

---

### 🏥 Clinic Users

| Email | Password | Use Case |
|-------|----------|----------|
| clinic@test.ayurlahi.com | Clinic@123 | Clinic operations, HMS features |
| clinic2@test.ayurlahi.com | Clinic@123 | Backup clinic account |

**Testing:**
- Create patients (auto-assigned to their clinic)
- Create doctors (auto-assigned to their clinic)
- Create appointments
- All HMS operations (medical records, prescriptions, lab reports, billing)
- Data is automatically isolated to their clinic

---

### 🏭 Manufacturer Users

| Email | Password | Use Case |
|-------|----------|----------|
| manufacturer@test.ayurlahi.com | Manufacturer@123 | Manufacturer operations |
| manufacturer2@test.ayurlahi.com | Manufacturer@123 | Backup manufacturer account |

**Testing:**
- Product management
- Order management
- Manufacturer-specific operations

---

## 🧪 Quick Login Examples

### Admin User
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.ayurlahi.com",
    "password": "Admin@123"
  }'
```

### Clinic User
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "clinic@test.ayurlahi.com",
    "password": "Clinic@123"
  }'
```

### Support User
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "support@test.ayurlahi.com",
    "password": "Support@123"
  }'
```

### Manufacturer User
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manufacturer@test.ayurlahi.com",
    "password": "Manufacturer@123"
  }'
```

---

## 📝 Testing Scenarios

### Scenario 1: Admin Testing HMS
1. Login as `admin@test.ayurlahi.com`
2. Get clinic ID: `GET /api/clinics`
3. Create patient with `clinicId` in request
4. Create doctor with `clinicId` in request
5. Create appointment (uses patient's clinicId automatically)

### Scenario 2: Clinic User Testing HMS
1. Login as `clinic@test.ayurlahi.com`
2. Create patient (no clinicId needed - auto-assigned)
3. Create doctor (no clinicId needed - auto-assigned)
4. Create appointment
5. Create medical records, prescriptions, etc.

### Scenario 3: Multi-Tenancy Testing
1. Login as `clinic@test.ayurlahi.com` - create some data
2. Login as `clinic2@test.ayurlahi.com` - verify data isolation
3. Login as `admin@test.ayurlahi.com` - verify can see all data

---

## 🔄 Re-running the Script

The script is idempotent - you can run it multiple times:

```bash
npm run seed:test-users
```

Existing users will be skipped (not duplicated).

---

## 🗑️ Cleaning Up

To remove all test users:

```sql
DELETE FROM users WHERE email LIKE '%@test.ayurlahi.com';
```

Or via psql:
```bash
psql -U your_username -d ayurlahi -c "DELETE FROM users WHERE email LIKE '%@test.ayurlahi.com';"
```

---

## 📄 Full Documentation

See `HMS_TEST_USERS.md` for complete details (generated after running the script).

---

**Last Updated**: December 24, 2025

