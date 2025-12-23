# 🔧 How to Fix Clinic Users - Step by Step

## Where to Run the Fix

You have **3 options** to fix the clinic users:

---

## Option 1: Terminal/Command Line (Easiest) ⭐

### Step 1: Open Terminal
Open your terminal (the same one you've been using).

### Step 2: Navigate to Project Directory
```bash
cd /Users/sayedsuhail/ayurlahi-backend
```

### Step 3: Run the SQL Script
```bash
psql -U postgres -d ayurlahi -f scripts/fix-clinic-users-clinicid.sql
```

**If it asks for a password**, enter your PostgreSQL password.

**Expected Output:**
```
NOTICE:  Found clinic ID: 6677fd76-4289-4b0d-845f-6e1d7e9f77db
NOTICE:  Updated 2 clinic user(s)
        email         | firstName | lastName | role  | clinicId
----------------------+-----------+----------+-------+--------------------------------------
 clinic@test.ayurlahi.com | Clinic    | User     | clinic | 6677fd76-4289-4b0d-845f-6e1d7e9f77db
 clinic2@test.ayurlahi.com | Clinic    | Two      | clinic | 6677fd76-4289-4b0d-845f-6e1d7e9f77db
```

---

## Option 2: PostgreSQL Client (pgAdmin, DBeaver, etc.)

### Step 1: Open Your PostgreSQL Client
- pgAdmin
- DBeaver
- TablePlus
- Or any PostgreSQL GUI tool

### Step 2: Connect to Database
- Host: `localhost`
- Port: `5432`
- Database: `ayurlahi`
- Username: `postgres`
- Password: (your password)

### Step 3: Open Query Tool
- In pgAdmin: Right-click database → Query Tool
- In DBeaver: Right-click database → SQL Editor

### Step 4: Open and Run the SQL File
1. Open the file: `scripts/fix-clinic-users-clinicid.sql`
2. Copy all the SQL content
3. Paste into the query tool
4. Click "Execute" or press F5

---

## Option 3: Direct SQL Command

### Step 1: Connect to PostgreSQL
```bash
psql -U postgres -d ayurlahi
```

### Step 2: Run SQL Commands
Copy and paste these commands:

```sql
-- Get clinic ID
SELECT id FROM clinics LIMIT 1;

-- Update clinic users (replace CLINIC_ID with the ID from above)
UPDATE users 
SET "clinicId" = '6677fd76-4289-4b0d-845f-6e1d7e9f77db'  -- Use the clinic ID from above
WHERE role = 'clinic' 
  AND "clinicId" IS NULL
  AND email LIKE '%@test.ayurlahi.com';

-- Verify
SELECT email, "clinicId" 
FROM users 
WHERE role = 'clinic' 
  AND email LIKE '%@test.ayurlahi.com';
```

### Step 3: Exit psql
```sql
\q
```

---

## Quick One-Liner (If you know your clinic ID)

If you already know your clinic ID is `6677fd76-4289-4b0d-845f-6e1d7e9f77db`:

```bash
psql -U postgres -d ayurlahi -c "UPDATE users SET \"clinicId\" = '6677fd76-4289-4b0d-845f-6e1d7e9f77db' WHERE role = 'clinic' AND \"clinicId\" IS NULL AND email LIKE '%@test.ayurlahi.com';"
```

---

## Verify the Fix Worked

After running the fix, verify:

```bash
psql -U postgres -d ayurlahi -c "SELECT email, \"clinicId\" FROM users WHERE role = 'clinic' AND email LIKE '%@test.ayurlahi.com';"
```

**Expected**: Both clinic users should show a `clinicId` (not NULL).

---

## Test Again

After fixing, test:

```bash
npm run test:hms:users
```

**Expected**: Clinic user tests should now pass! ✅

---

## Troubleshooting

### "psql: command not found"
- Install PostgreSQL client tools
- Or use a GUI tool (Option 2)

### "password authentication failed"
- Check your PostgreSQL password
- Or use: `PGPASSWORD=your_password psql -U postgres -d ayurlahi -f scripts/fix-clinic-users-clinicid.sql`

### "connection refused"
- Make sure PostgreSQL is running
- Check connection settings

### "relation 'clinics' does not exist"
- Make sure you've run the migrations
- Check that clinics table exists

---

## Recommended: Use Option 1

**Just run this in your terminal:**

```bash
cd /Users/sayedsuhail/ayurlahi-backend
psql -U postgres -d ayurlahi -f scripts/fix-clinic-users-clinicid.sql
```

That's it! Then test again with `npm run test:hms:users`.

---

**Status**: ✅ **READY TO RUN**

**Location**: Run in your terminal (same directory as your project)

