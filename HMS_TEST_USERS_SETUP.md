# 🧪 HMS Test Users Setup Guide

## Overview

This guide helps you create test accounts for all user types to make testing easier.

---

## 🚀 Quick Start

### Option 1: Node.js Script (Recommended)

```bash
npm run seed:test-users
```

**What it does:**
- Creates 7 test users (2 admin, 1 support, 2 clinic, 2 manufacturer)
- Uses proper bcrypt password hashing
- Automatically finds and assigns clinic IDs
- Saves all credentials to `HMS_TEST_USERS.md`
- Shows creation status

### Option 2: SQL Script (Backup)

```bash
psql -U your_username -d ayurlahi -f scripts/seed-test-users.sql
```

**Note**: You'll need to generate bcrypt hashes first (see script comments).

---

## 📋 Test Users Created

### Admin Users (2)
- `admin@test.ayurlahi.com` / `Admin@123`
- `admin2@test.ayurlahi.com` / `Admin@123`

**Use for:**
- Testing admin operations
- Creating records for any clinic
- Full system access testing

### Support Users (1)
- `support@test.ayurlahi.com` / `Support@123`

**Use for:**
- Testing support operations
- Viewing all clinics
- Read-only operations

### Clinic Users (2)
- `clinic@test.ayurlahi.com` / `Clinic@123`
- `clinic2@test.ayurlahi.com` / `Clinic@123`

**Use for:**
- Testing HMS features
- Testing clinic-specific operations
- Testing multi-tenancy
- All HMS CRUD operations

### Manufacturer Users (2)
- `manufacturer@test.ayurlahi.com` / `Manufacturer@123`
- `manufacturer2@test.ayurlahi.com` / `Manufacturer@123`

**Use for:**
- Testing manufacturer operations
- Product management
- Order management

---

## 📄 Generated Documentation

After running the script, you'll get:

1. **HMS_TEST_USERS.md** - Complete document with:
   - All user credentials
   - User IDs
   - Clinic IDs (for clinic users)
   - Testing scenarios
   - Login examples

2. **HMS_TEST_USERS_QUICK_REFERENCE.md** - Quick reference guide

---

## 🧪 Testing Workflow

### 1. Create Test Users
```bash
npm run seed:test-users
```

### 2. Login and Get Token
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "clinic@test.ayurlahi.com",
    "password": "Clinic@123"
  }'
```

### 3. Use Token for Testing
```bash
# Save token from step 2, then:
curl -X GET http://localhost:3000/api/patients \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔄 Re-running

The script is idempotent - safe to run multiple times:

```bash
npm run seed:test-users
```

Existing users will be skipped (not duplicated).

---

## 🗑️ Cleanup

To remove all test users:

```bash
psql -U your_username -d ayurlahi -c "DELETE FROM users WHERE email LIKE '%@test.ayurlahi.com';"
```

---

## 📚 Files Created

- `scripts/seed-test-users.js` - Node.js seeding script
- `scripts/seed-test-users.sql` - SQL backup script
- `HMS_TEST_USERS.md` - Complete credentials document (generated)
- `HMS_TEST_USERS_QUICK_REFERENCE.md` - Quick reference guide

---

## ✅ Next Steps

1. **Run the script:**
   ```bash
   npm run seed:test-users
   ```

2. **Check the generated document:**
   ```bash
   cat HMS_TEST_USERS.md
   ```

3. **Start testing with different user types!**

---

**Status**: ✅ **READY TO USE**

**Command**: `npm run seed:test-users`

