# 🧪 Test Users Guide

## Overview

This guide explains how to create test user accounts for all roles in the system.

---

## Quick Start

Run the seed script to create all test users:

```bash
npm run seed:test-users
```

**Password for all users**: `abc123123`

---

## Test Accounts Created

### Admin Users
- **Email**: `admin@test.com`
- **Password**: `abc123123`
- **Role**: `admin`
- **Access**: Full system access

### Support Users
- **Email**: `support@test.com`
- **Password**: `abc123123`
- **Role**: `support`
- **Access**: Support and troubleshooting access

### Clinic Users
- **Email**: `clinic1@test.com`
- **Password**: `abc123123`
- **Role**: `clinic`
- **Clinic**: Test Clinic 1 (auto-created)
- **Access**: HMS features, patient management, etc.

- **Email**: `clinic2@test.com`
- **Password**: `abc123123`
- **Role**: `clinic`
- **Clinic**: Test Clinic 2 (auto-created)
- **Access**: HMS features, patient management, etc.

### Manufacturer Users
- **Email**: `manufacturer1@test.com`
- **Password**: `abc123123`
- **Role**: `manufacturer`
- **Manufacturer**: Test Manufacturer 1 (auto-created)
- **Access**: Marketplace features, product management, etc.

- **Email**: `manufacturer2@test.com`
- **Password**: `abc123123`
- **Role**: `manufacturer`
- **Manufacturer**: Test Manufacturer 2 (auto-created)
- **Access**: Marketplace features, product management, etc.

---

## What Gets Created

### Users (6)
- 1 Admin user
- 1 Support user
- 2 Clinic users
- 2 Manufacturer users

### Clinics (2)
- Test Clinic 1 (linked to clinic1@test.com)
- Test Clinic 2 (linked to clinic2@test.com)

### Manufacturers (2)
- Test Manufacturer 1 (linked to manufacturer1@test.com)
- Test Manufacturer 2 (linked to manufacturer2@test.com)

---

## Database Field Names

The script uses **snake_case** column names as per the database schema:

- `password_hash` (not `passwordHash`)
- `first_name` (not `firstName`)
- `last_name` (not `lastName`)
- `clinic_id` (not `clinicId`)
- `manufacturer_id` (not `manufacturerId`)
- `is_active` (not `isActive`)
- `is_email_verified` (not `isEmailVerified`)
- `created_at` (not `createdAt`)
- `updated_at` (not `updatedAt`)

---

## Usage

### Testing HMS Features

Use clinic accounts to test HMS:
```bash
# Login as clinic user
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "clinic1@test.com",
    "password": "abc123123"
  }'
```

### Testing Marketplace Features

Use manufacturer accounts to test marketplace:
```bash
# Login as manufacturer user
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manufacturer1@test.com",
    "password": "abc123123"
  }'
```

### Testing Admin Features

Use admin account for full access:
```bash
# Login as admin user
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "abc123123"
  }'
```

---

## Script Details

### What the Script Does

1. **Reads database config** from `.env` file
2. **Hashes password** using bcrypt (10 salt rounds)
3. **Creates users** with all required fields
4. **Creates clinics** for clinic users
5. **Creates manufacturers** for manufacturer users
6. **Links users** to their clinics/manufacturers

### Error Handling

- Checks if users already exist (skips if found)
- Checks if clinics/manufacturers already exist
- Shows clear error messages
- Continues even if some operations fail

---

## Troubleshooting

### "User already exists"
- The script will skip existing users
- To recreate, delete the user first:
  ```sql
  DELETE FROM users WHERE email = 'clinic1@test.com';
  ```

### "Clinic already exists"
- The script will use existing clinic
- To recreate, delete clinic and user:
  ```sql
  DELETE FROM clinics WHERE "userId" = 'user-id-here';
  DELETE FROM users WHERE id = 'user-id-here';
  ```

### "bcrypt error"
- Ensure bcrypt is installed: `npm install bcrypt`
- The script will fallback to simple hash (not secure)

### "Permission denied"
- Ensure database user has INSERT/UPDATE permissions
- Grant permissions if needed:
  ```sql
  GRANT ALL PRIVILEGES ON users TO your_username;
  GRANT ALL PRIVILEGES ON clinics TO your_username;
  GRANT ALL PRIVILEGES ON manufacturers TO your_username;
  ```

---

## Security Notes

⚠️ **Important**: These are test accounts with a simple password!

- **DO NOT** use in production
- **DO NOT** use real email addresses
- **DO NOT** commit passwords to git
- **DO** change passwords before production
- **DO** use strong passwords in production

---

## Next Steps

After creating test users:

1. ✅ Test login with each account
2. ✅ Test HMS features with clinic accounts
3. ✅ Test marketplace features with manufacturer accounts
4. ✅ Test admin features with admin account
5. ✅ Create test data (patients, doctors, etc.)

---

## Summary

- **Total Users**: 6
- **Total Clinics**: 2
- **Total Manufacturers**: 2
- **Password**: `abc123123` (all accounts)
- **Script**: `npm run seed:test-users`

**Ready to test!** 🚀

