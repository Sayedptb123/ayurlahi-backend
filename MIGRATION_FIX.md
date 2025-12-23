# Fix for Staff Table Migration Error

## Problem
The staff table already exists but with a different structure (wrong column names), causing the migration to fail.

## Solution

You have two options:

### Option 1: Drop and Recreate (Recommended for Development)

Since the table appears to be newly created and likely empty, the safest approach is to drop and recreate it:

```bash
cd /Users/sayedsuhail/ayurlahi-backend
psql -U postgres -d ayurlahi -f migrations/fix-staff-table.sql
```

This script will:
1. Drop the existing staff table (and any related indexes/constraints)
2. Recreate it with the correct structure
3. Add all indexes and constraints

### Option 2: Use the Safe Migration Script

If you want to preserve any existing data (though the table is likely empty):

```bash
# First, check what's in the table
psql -U postgres -d ayurlahi -c "SELECT COUNT(*) FROM staff;"

# If empty (count = 0), use the safe migration
psql -U postgres -d ayurlahi -f migrations/create-staff-table-safe.sql
```

### Option 3: Manual Drop and Recreate

If you prefer to do it manually:

```sql
-- Connect to database
psql -U postgres -d ayurlahi

-- Drop the table
DROP TABLE IF EXISTS staff CASCADE;

-- Then run the original migration
\i migrations/create-staff-table.sql
```

## Verify the Fix

After running the migration, verify the table structure:

```bash
psql -U postgres -d ayurlahi -c "\d staff"
```

You should see all the correct columns:
- organization_id
- organization_type
- first_name
- last_name
- position
- position_custom
- email
- phone
- whatsapp_number
- address_street
- address_city
- address_district
- address_state
- address_zip_code
- address_country
- date_of_birth
- date_of_joining
- salary
- qualifications
- specialization
- is_active
- notes
- created_at
- updated_at

## Next Steps

After fixing the table structure:

1. ✅ The backend code is already in place
2. ✅ The StaffModule is registered in app.module.ts
3. ✅ You can now start the backend server
4. ✅ Test the staff endpoints from the frontend

