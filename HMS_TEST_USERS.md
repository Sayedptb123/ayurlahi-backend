# 🧪 HMS Test Users

**Generated**: 2025-12-23T20:48:05.546Z
**Purpose**: Test accounts for all user types

---

## ⚠️ Important Notes

- **These are test accounts only** - Do not use in production
- **All passwords are simple** - Change them in production
- **Keep this document secure** - Contains test credentials

---

## 📋 Quick Reference

| Role | Email | Password | Use Case |
|------|-------|----------|----------|
| Admin | admin@test.ayurlahi.com | Admin@123 | Full system access |
| Support | support@test.ayurlahi.com | Support@123 | Support operations |
| Clinic | clinic@test.ayurlahi.com | Clinic@123 | Clinic operations |
| Manufacturer | manufacturer@test.ayurlahi.com | Manufacturer@123 | Manufacturer operations |

---

## 👑 Admin Users

Admin users have full system access and can manage all clinics.

### Admin User 1

- **Email**: `admin@test.ayurlahi.com`
- **Password**: `Admin@123`
- **Name**: Admin User
- **Phone**: 1234567890
- **User ID**: `b3234420-719b-408c-aa21-f39a0f4d0e8a`
- **Use Case**: Testing admin operations, creating records for any clinic

### Admin User 2

- **Email**: `admin2@test.ayurlahi.com`
- **Password**: `Admin@123`
- **Name**: Admin Two
- **Phone**: 1234567891
- **User ID**: `2ebd9e76-6d0f-467f-8d01-f5458b0d4451`
- **Use Case**: Testing admin operations, creating records for any clinic

## 🛟 Support Users

Support users can view all clinics and assist with operations.

### Support User 1

- **Email**: `support@test.ayurlahi.com`
- **Password**: `Support@123`
- **Name**: Support User
- **Phone**: 1234567892
- **User ID**: `f8231e6d-1c2b-4061-a6ce-8ad0ab8218db`
- **Use Case**: Testing support operations, viewing all clinics

## 🏥 Clinic Users

Clinic users can manage their own clinic's data (patients, doctors, appointments, etc.).

### Clinic User 1

- **Email**: `clinic@test.ayurlahi.com`
- **Password**: `Clinic@123`
- **Name**: Clinic User
- **Phone**: 1234567893
- **User ID**: `f137341e-a156-4ba7-b61f-c4fc5f541d47`
- **Clinic ID**: `6677fd76-4289-4b0d-845f-6e1d7e9f77db`
- **Use Case**: Testing clinic operations, HMS features

### Clinic User 2

- **Email**: `clinic2@test.ayurlahi.com`
- **Password**: `Clinic@123`
- **Name**: Clinic Two
- **Phone**: 1234567894
- **User ID**: `2b6d702e-a61e-4965-8034-ad00a602f60b`
- **Clinic ID**: `6677fd76-4289-4b0d-845f-6e1d7e9f77db`
- **Use Case**: Testing clinic operations, HMS features

## 🏭 Manufacturer Users

Manufacturer users can manage their products and orders.

### Manufacturer User 1

- **Email**: `manufacturer@test.ayurlahi.com`
- **Password**: `Manufacturer@123`
- **Name**: Manufacturer User
- **Phone**: 1234567895
- **User ID**: `b7a52b73-e916-4904-bc20-33da912a42b1`
- **Use Case**: Testing manufacturer operations, product management

### Manufacturer User 2

- **Email**: `manufacturer2@test.ayurlahi.com`
- **Password**: `Manufacturer@123`
- **Name**: Manufacturer Two
- **Phone**: 1234567896
- **User ID**: `c38724f0-6f04-4d30-bc3b-6b8b0df225aa`
- **Use Case**: Testing manufacturer operations, product management

---

## 🧪 Testing Scenarios

### Admin User Testing
```bash
# Login as admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.ayurlahi.com",
    "password": "Admin@123"
  }'
```

**What to test:**
- Create patients/doctors for any clinic
- View all clinics
- Manage all data

### Clinic User Testing
```bash
# Login as clinic user
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "clinic@test.ayurlahi.com",
    "password": "Clinic@123"
  }'
```

**What to test:**
- Create patients (auto-assigned to their clinic)
- Create doctors (auto-assigned to their clinic)
- Create appointments
- All HMS operations

### Support User Testing
```bash
# Login as support user
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "support@test.ayurlahi.com",
    "password": "Support@123"
  }'
```

**What to test:**
- View all clinics
- View all data (read-only operations)

### Manufacturer User Testing
```bash
# Login as manufacturer user
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manufacturer@test.ayurlahi.com",
    "password": "Manufacturer@123"
  }'
```

**What to test:**
- Product management
- Order management
- Manufacturer-specific operations

---

## 🔄 Re-running the Script

To recreate test users:

```bash
npm run seed:test-users
```

**Note**: Existing users will be skipped (not duplicated).

---

## 🗑️ Cleaning Up

To remove test users:

```sql
DELETE FROM users WHERE email LIKE '%@test.ayurlahi.com';
```

---

**Last Updated**: 2025-12-23T20:48:05.547Z
