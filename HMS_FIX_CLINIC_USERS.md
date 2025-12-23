# 🔧 Fix: Clinic Users Missing Clinic ID

## Problem

Clinic users created via the API registration endpoint don't have a `clinicId` set, causing errors when trying to create patients/doctors:

```
"Clinic not associated with user"
```

## Solution

Update existing clinic users to have a `clinicId` assigned.

---

## Quick Fix

### Option 1: Run SQL Script (Recommended)

```bash
psql -U your_username -d ayurlahi -f scripts/fix-clinic-users-clinicid.sql
```

This will:
- Find the first clinic in your database
- Update all clinic test users to have that clinicId
- Show verification results

### Option 2: Run Node.js Script

```bash
npm run fix:clinic-users
```

**Note**: Requires database connection access.

### Option 3: Manual SQL

```sql
-- Get clinic ID first
SELECT id FROM clinics LIMIT 1;

-- Update clinic users (replace CLINIC_ID with actual ID)
UPDATE users 
SET "clinicId" = 'CLINIC_ID_HERE'
WHERE role = 'clinic' 
  AND "clinicId" IS NULL
  AND email LIKE '%@test.ayurlahi.com';
```

---

## Verify Fix

After running the fix, verify:

```sql
SELECT email, "clinicId" 
FROM users 
WHERE role = 'clinic' 
  AND email LIKE '%@test.ayurlahi.com';
```

**Expected**: All clinic users should have a `clinicId` set.

---

## Test Again

After fixing, test again:

```bash
npm run test:hms:users
```

**Expected**: Clinic user tests should now pass!

---

## Prevention

The seeding script has been updated to create clinic users via database (not API) so they get `clinicId` set from the start.

If you recreate test users:

```bash
npm run seed:test-users
```

New clinic users will have `clinicId` set correctly.

---

**Status**: ✅ **FIX AVAILABLE**  
**Date**: December 24, 2025

