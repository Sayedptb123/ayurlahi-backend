# Migration Guide: Fix Users Table Schema

## Overview

This guide helps you align the `users` table database schema with the TypeORM `User` entity by renaming columns to snake_case.

---

## Step 1: Check Current Schema

First, check what columns currently exist in your database:

```bash
npm run check:schema
```

Or manually:
```bash
psql -U postgres -d ayurlahi -c "\d users"
```

This will show you:
- Current column names
- Which columns need to be renamed
- Which columns are already correct

---

## Step 2: Review the Migration

The migration file `migrations/fix-users-table-schema.sql` will:

✅ **Rename columns safely** (only if they exist and target doesn't exist):
- `password` → `password_hash`
- `firstName` → `first_name`
- `lastName` → `last_name`
- `isActive` → `is_active`
- `isEmailVerified` → `is_email_verified`
- `createdAt` → `created_at`
- `updatedAt` → `updated_at`
- `clinicId` → `clinic_id`
- `manufacturerId` → `manufacturer_id`
- `lastLoginAt` → `last_login_at`
- `whatsappNumber` → `whatsapp_number`
- `mobileNumbers` → `mobile_numbers`

✅ **Safe to run multiple times** - Uses `DO $$` blocks to check before renaming

✅ **No data loss** - Only renames columns, doesn't modify data

---

## Step 3: Run the Migration

### Option A: Using npm script (Recommended)

```bash
npm run migrate:fix-users
```

You'll be prompted for your PostgreSQL password if not in `.env`.

### Option B: Direct psql command

```bash
psql -U postgres -d ayurlahi -f migrations/fix-users-table-schema.sql
```

Or with password:
```bash
PGPASSWORD=your_password psql -U postgres -d ayurlahi -f migrations/fix-users-table-schema.sql
```

---

## Step 4: Verify the Migration

After running the migration, verify the schema:

```bash
npm run check:schema
```

Or:
```bash
psql -U postgres -d ayurlahi -c "\d users"
```

**Expected result**: All columns should now be in snake_case matching the entity.

---

## Step 5: Test

After migration, test that everything works:

1. **Test login**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@ayurlahi.com","password":"Admin@123"}'
   ```

2. **Test seed script**:
   ```bash
   npm run seed:test-users
   ```

Both should work without column name errors.

---

## What This Fixes

### Before Migration
- ❌ Database has: `password`, `firstName`, `lastName` (camelCase)
- ❌ Entity expects: `password_hash`, `first_name`, `last_name` (snake_case)
- ❌ Seed script fails: "column password_hash does not exist"

### After Migration
- ✅ Database has: `password_hash`, `first_name`, `last_name` (snake_case)
- ✅ Entity expects: `password_hash`, `first_name`, `last_name` (snake_case)
- ✅ Seed script works: All columns match

---

## Troubleshooting

### "column already exists" error
- The migration checks before renaming, so this shouldn't happen
- If it does, the column might already be correctly named

### "permission denied"
- Ensure your database user has ALTER TABLE permissions:
  ```sql
  GRANT ALL PRIVILEGES ON users TO your_username;
  ```

### "relation users does not exist"
- The users table doesn't exist yet
- Create it first or check if it's named differently

### Migration runs but columns still wrong
- Check if columns are in a different schema
- Verify you're connected to the correct database
- Check for typos in column names

---

## Rollback (If Needed)

If you need to rollback, you can reverse the renames:

```sql
-- Reverse the migration (if needed)
ALTER TABLE users RENAME COLUMN password_hash TO password;
ALTER TABLE users RENAME COLUMN first_name TO "firstName";
ALTER TABLE users RENAME COLUMN last_name TO "lastName";
-- ... etc
```

**Note**: Only rollback if absolutely necessary. The snake_case naming is the recommended approach.

---

## Best Practices Going Forward

1. ✅ **Always use explicit `name` in @Column decorator**:
   ```typescript
   @Column({ name: 'password_hash' })
   passwordHash: string;
   ```

2. ✅ **Standardize on snake_case for database columns**:
   - PostgreSQL convention
   - Works well with TypeORM
   - Consistent across codebase

3. ✅ **Verify schema matches entity before writing SQL**:
   - Check actual column names
   - Use same naming convention as entities

4. ✅ **Use migrations, not synchronize**:
   - `synchronize: false` (already set)
   - Create explicit migrations
   - Review before running

---

## Summary

- **Migration File**: `migrations/fix-users-table-schema.sql`
- **Check Script**: `npm run check:schema`
- **Run Migration**: `npm run migrate:fix-users`
- **Result**: Database schema matches User entity

**After migration, your seed script will work correctly!** 🎉

---

*Migration Date: December 24, 2025*

