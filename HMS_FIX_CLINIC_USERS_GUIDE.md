# 🔧 Fix Clinic Users - Complete Guide

## Problem

Clinic users don't have `clinicId` set, causing "Clinic not associated with user" errors.

There's also a **unique constraint** on `clinicId` that might prevent multiple users from having the same clinicId.

---

## Solution Options

### Option 1: Simple Fix (Try This First)

Run this SQL script that handles the unique constraint:

```bash
psql -U postgres -d ayurlahi -f scripts/fix-clinic-users-final.sql
```

This script will:
- Check current state
- Find which user already has the clinicId
- Assign clinic users to available clinics
- Handle unique constraint violations gracefully

---

### Option 2: Manual SQL (If Option 1 Doesn't Work)

#### Step 1: Check Current State
```sql
-- See which users have clinicId
SELECT email, role, "clinicId" 
FROM users 
WHERE "clinicId" = '6677fd76-4289-4b0d-845f-6e1d7e9f77db';

-- See clinic users
SELECT email, role, "clinicId" 
FROM users 
WHERE role = 'clinic' 
  AND email LIKE '%@test.ayurlahi.com';
```

#### Step 2: Update One User at a Time
```sql
-- Update first clinic user
UPDATE users 
SET "clinicId" = '6677fd76-4289-4b0d-845f-6e1d7e9f77db'
WHERE email = 'clinic@test.ayurlahi.com'
  AND role = 'clinic';
```

#### Step 3: If Second User Fails
If updating the second user fails due to unique constraint:

**Option A**: Create another clinic and assign second user to it
**Option B**: Use only one clinic user for testing
**Option C**: Check if the unique constraint should be removed

---

### Option 3: Check and Remove Unique Constraint (If Needed)

If multiple users should be able to belong to the same clinic, you might need to check/remove the unique constraint:

```sql
-- Check constraints on users table
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
  AND conname LIKE '%clinic%';
```

**Note**: Be careful removing constraints - understand the business logic first!

---

## Recommended Approach

1. **Run the one-by-one fix (RECOMMENDED):**
   ```bash
   psql -U postgres -d ayurlahi -f scripts/fix-clinic-users-one-by-one.sql
   ```
   
   This updates users one at a time, avoiding the unique constraint violation.

2. **After running**, test again:
   ```bash
   npm run test:hms:users
   ```

3. **Expected Result:**
   - `clinic@test.ayurlahi.com` will have clinicId ✅
   - `clinic2@test.ayurlahi.com` might fail (due to unique constraint) ⚠️
   - At least one clinic user will work for testing ✅

---

## Quick One-Liner (If Only One User Needs Fix)

If you only need to fix one clinic user:

```bash
psql -U postgres -d ayurlahi -c "UPDATE users SET \"clinicId\" = '6677fd76-4289-4b0d-845f-6e1d7e9f77db' WHERE email = 'clinic@test.ayurlahi.com' AND role = 'clinic';"
```

---

## Verify Fix

After running the fix:

```sql
SELECT email, "clinicId" 
FROM users 
WHERE role = 'clinic' 
  AND email LIKE '%@test.ayurlahi.com';
```

**Expected**: At least one clinic user should have a `clinicId` set.

---

## Test Again

```bash
npm run test:hms:users
```

**Expected**: Clinic user tests should pass (at least for the user with clinicId).

---

**Status**: ✅ **FIX SCRIPTS READY**

**Recommended**: Run `scripts/fix-clinic-users-final.sql`

