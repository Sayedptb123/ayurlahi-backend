# 👥 HMS Test Users Guide

## Test Accounts Created

A seed script has been created to generate test accounts for all user roles.

---

## Available Test Accounts

All accounts use the same password for easy testing:

**Password**: `Test123!`

### Accounts

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| **Clinic** | `test-clinic@ayurlahi.com` | `Test123!` | Clinic user with associated clinic |
| **Manufacturer** | `test-manufacturer@ayurlahi.com` | `Test123!` | Manufacturer user with associated manufacturer |
| **Admin** | `test-admin@ayurlahi.com` | `Test123!` | Admin user (full access) |
| **Support** | `test-support@ayurlahi.com` | `Test123!` | Support user (admin-like access) |

---

## Creating Test Users

### Run the Seed Script

```bash
npm run seed:test-users
```

This will:
1. ✅ Create 4 test users (clinic, manufacturer, admin, support)
2. ✅ Create a test clinic and link it to clinic user
3. ✅ Create a test manufacturer and link it to manufacturer user
4. ✅ Set all required fields (clinicId, manufacturerId, etc.)
5. ✅ Use the same password (`Test123!`) for all accounts

---

## What Gets Created

### Users
- **4 users** with different roles
- All with password: `Test123!`
- All with `isActive: true`
- All with `isEmailVerified: true`

### Clinic
- **1 test clinic** linked to clinic user
- Name: "Test Clinic"
- Status: Approved
- Verified: Yes

### Manufacturer
- **1 test manufacturer** linked to manufacturer user
- Name: "Test Manufacturer"
- Status: Approved
- Verified: Yes

---

## Using Test Accounts

### Login Example

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-clinic@ayurlahi.com",
    "password": "Test123!"
  }'
```

### Test with Different Roles

```bash
# Clinic user
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test-clinic@ayurlahi.com","password":"Test123!"}'

# Manufacturer user
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test-manufacturer@ayurlahi.com","password":"Test123!"}'

# Admin user
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test-admin@ayurlahi.com","password":"Test123!"}'

# Support user
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test-support@ayurlahi.com","password":"Test123!"}'
```

---

## Role Permissions

### Clinic User
- ✅ Can access HMS modules (patients, doctors, appointments, etc.)
- ✅ Can only see data for their clinic
- ✅ Can create/update/delete within their clinic

### Manufacturer User
- ✅ Can access manufacturer-specific features
- ✅ Can manage products
- ✅ Can view orders

### Admin User
- ✅ Full access to all features
- ✅ Can view all clinics
- ✅ Can manage all data
- ✅ Can access analytics

### Support User
- ✅ Similar to admin
- ✅ Can view all clinics
- ✅ Can access support features

---

## Testing HMS with Clinic User

The clinic user is perfect for testing HMS features:

```bash
# 1. Login as clinic user
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test-clinic@ayurlahi.com","password":"Test123!"}' \
  | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

# 2. Create a patient
curl -X POST http://localhost:3000/api/patients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "patientId": "P001",
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1990-01-01",
    "gender": "male",
    "phone": "1234567890"
  }'
```

---

## Resetting Test Users

If you need to recreate test users:

```bash
# The script will skip existing users
# To recreate, delete users first:

psql -U postgres -d ayurlahi -c "
DELETE FROM users WHERE email IN (
  'test-clinic@ayurlahi.com',
  'test-manufacturer@ayurlahi.com',
  'test-admin@ayurlahi.com',
  'test-support@ayurlahi.com'
);
"

# Then run seed script again
npm run seed:test-users
```

---

## Troubleshooting

### "User already exists"
- The script will skip existing users
- This is safe - existing users won't be modified

### "Password doesn't work"
- Ensure bcrypt is installed: `npm install bcrypt`
- Re-run the seed script

### "Clinic/Manufacturer not linked"
- The script automatically links clinic/manufacturer to users
- Check if clinic/manufacturer was created successfully

---

## Next Steps

After creating test users:

1. ✅ Test login with each role
2. ✅ Test HMS features with clinic user
3. ✅ Test permissions for each role
4. ✅ Create test data (patients, doctors, etc.)

---

**Ready to create test users?** Run:

```bash
npm run seed:test-users
```

---

*All test accounts use password: `Test123!`*

