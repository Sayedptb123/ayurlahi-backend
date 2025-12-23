# Schema Mismatch Analysis & Solution

## 🔍 Root Cause

**This is NOT about "model approach"** - it's about **legacy schema drift**:

1. **The `users` table was created BEFORE the naming convention was standardized**
   - Database has: `camelCase` columns (`password`, `firstName`, `createdAt`)
   - Entity expects: `snake_case` columns (`password_hash`, `first_name`, `created_at`)

2. **The CustomNamingStrategy only affects NEW tables**
   - Existing tables are not automatically updated
   - `synchronize: false` prevents auto-updates

3. **Missing enum types in database**
   - `gender` in `patients` table: entity expects `enum`, DB has `character varying`
   - `role` in `users` table: entity expects `varchar`, DB has `USER-DEFINED` (enum)

---

## ✅ Solution: Create Migrations

### 1. Fix Users Table Column Names
**File**: `migrations/010-fix-users-table-column-names.sql`

Renames camelCase columns to snake_case:
- `password` → `password_hash`
- `firstName` → `first_name`
- `lastName` → `last_name`
- `isActive` → `is_active`
- `isEmailVerified` → `is_email_verified`
- `whatsappNumber` → `whatsapp_number`
- `lastLoginAt` → `last_login_at`
- `clinicId` → `clinic_id`
- `manufacturerId` → `manufacturer_id`
- `createdAt` → `created_at`
- `updatedAt` → `updated_at`

### 2. Fix Patient Gender Enum
**File**: `migrations/011-fix-patient-gender-enum.sql`

Creates `gender_enum` type and converts `gender` column from `varchar` to `enum`.

### 3. Fix User Role Enum
**File**: `migrations/012-fix-user-role-enum.sql`

Ensures `user_role_enum` type exists and is properly configured.

---

## 📋 Execution Steps

### Option 1: Run Individual Migrations
```bash
# Fix users table columns
psql -U postgres -d ayurlahi -f migrations/010-fix-users-table-column-names.sql

# Fix patient gender enum
psql -U postgres -d ayurlahi -f migrations/011-fix-patient-gender-enum.sql

# Fix user role enum
psql -U postgres -d ayurlahi -f migrations/012-fix-user-role-enum.sql
```

### Option 2: Run All Fixes
```bash
# Create a combined migration file
cat migrations/010-fix-users-table-column-names.sql \
    migrations/011-fix-patient-gender-enum.sql \
    migrations/012-fix-user-role-enum.sql > migrations/013-fix-all-schema-mismatches.sql

# Run it
psql -U postgres -d ayurlahi -f migrations/013-fix-all-schema-mismatches.sql
```

### Verify After Migration
```bash
npm run verify:schema
```

**Expected Result**: All entities should verify successfully ✅

---

## 🎯 Why This Happened

### Timeline:
1. **Initial Setup**: `users` table created with `camelCase` (possibly with `synchronize: true` or manual SQL)
2. **Naming Strategy Added**: `CustomNamingStrategy` was added to standardize to `snake_case`
3. **Entity Updated**: User entity was updated to use explicit `@Column({ name: '...' })` with `snake_case`
4. **Schema Drift**: Database schema didn't match entity definitions

### Prevention:
- ✅ Always use migrations (not `synchronize: true`)
- ✅ Use consistent naming strategy from the start
- ✅ Run schema verification regularly (`npm run verify:schema`)

---

## 📊 Current Status

**Before Migration**:
- ❌ 12 entities verified
- ❌ 28 issues found
  - 13 missing columns (snake_case expected, camelCase in DB)
  - 13 extra columns (camelCase in DB, not in entity)
  - 2 type mismatches (enum issues)

**After Migration** (Expected):
- ✅ 14 entities verified
- ✅ 0 issues found

---

## 🔄 Alternative: Update Entity to Match DB

If you prefer to keep the existing database schema, you can:

1. **Remove explicit `name` properties** from User entity
2. **Let CustomNamingStrategy handle it** (but this won't work for existing camelCase columns)
3. **Or manually update entity** to use camelCase column names

**Recommendation**: Use migrations to standardize on `snake_case` (better for PostgreSQL conventions).

---

## ✅ Next Steps

1. **Review the migration files** (check column names match your needs)
2. **Backup your database** (before running migrations)
3. **Run the migrations**
4. **Verify schema**: `npm run verify:schema`
5. **Test the application** (ensure everything still works)

---

**Status**: ✅ **MIGRATIONS CREATED - READY TO RUN**

