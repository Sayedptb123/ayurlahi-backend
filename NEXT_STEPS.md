# Next Steps - Schema Migration Guide

## 🎯 Current Status

✅ **Migrations Created**:
- `010-fix-users-table-column-names.sql` - Fixes users table column names
- `011-fix-patient-gender-enum.sql` - Fixes patient gender enum
- `012-fix-user-role-enum.sql` - Fixes user role enum
- `013-fix-all-schema-mismatches.sql` - **Combined migration (recommended)**

---

## 📋 Step-by-Step Execution

### Step 1: Review Migrations ⚠️

**Before running**, review the migration files to ensure they match your requirements:

```bash
# Review the combined migration
cat migrations/013-fix-all-schema-mismatches.sql

# Or review individual migrations
cat migrations/010-fix-users-table-column-names.sql
cat migrations/011-fix-patient-gender-enum.sql
cat migrations/012-fix-user-role-enum.sql
```

**Key Points to Verify**:
- ✅ Column names match your entity definitions
- ✅ Enum values match your TypeScript enums
- ✅ No data loss (migrations preserve existing data)

---

### Step 2: Backup Database 🔒

**CRITICAL**: Always backup before running migrations!

```bash
# Backup the database
pg_dump -U postgres -d ayurlahi > backup_$(date +%Y%m%d_%H%M%S).sql

# Or with password
PGPASSWORD=your_password pg_dump -U postgres -d ayurlahi > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Verify backup**:
```bash
# Check backup file exists and has content
ls -lh backup_*.sql
head -20 backup_*.sql
```

---

### Step 3: Run Migration 🚀

**Option A: Run Combined Migration (Recommended)**
```bash
# Single command to fix everything
psql -U postgres -d ayurlahi -f migrations/013-fix-all-schema-mismatches.sql

# Or with password
PGPASSWORD=your_password psql -U postgres -d ayurlahi -f migrations/013-fix-all-schema-mismatches.sql
```

**Option B: Run Individual Migrations**
```bash
# Run them in order
psql -U postgres -d ayurlahi -f migrations/010-fix-users-table-column-names.sql
psql -U postgres -d ayurlahi -f migrations/011-fix-patient-gender-enum.sql
psql -U postgres -d ayurlahi -f migrations/012-fix-user-role-enum.sql
```

---

### Step 4: Verify Migration ✅

**Check Schema Verification**:
```bash
npm run verify:schema
```

**Expected Output**:
```
✓ Verified: 14 entities
✓ All verified schemas match!
```

**Manual Verification** (optional):
```sql
-- Check users table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Check patients gender column
SELECT column_name, data_type, udt_name
FROM information_schema.columns 
WHERE table_name = 'patients' AND column_name = 'gender';

-- Check users role column
SELECT column_name, data_type, udt_name
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'role';
```

---

### Step 5: Test Application 🧪

**Start the server**:
```bash
npm run start:dev
```

**Test Key Endpoints**:
```bash
# Test login (uses users table)
npm run test:hms

# Test patient creation (uses patients table with enum)
# Use your API testing tools or Postman
```

**Check for Errors**:
- ✅ No TypeORM errors about column names
- ✅ No enum type errors
- ✅ All API endpoints work correctly

---

## 🔄 If Something Goes Wrong

### Rollback Plan

**If migration fails mid-way**:
```sql
-- Check transaction status
SELECT * FROM pg_stat_activity WHERE datname = 'ayurlahi';

-- If needed, rollback manually (if transaction is still open)
ROLLBACK;
```

**If you need to restore from backup**:
```bash
# Drop and recreate database (WARNING: Data loss!)
dropdb -U postgres ayurlahi
createdb -U postgres ayurlahi

# Restore from backup
psql -U postgres -d ayurlahi < backup_YYYYMMDD_HHMMSS.sql
```

---

## 📊 Expected Results

### Before Migration:
- ❌ 12 entities verified
- ❌ 28 issues found
  - 13 missing columns (snake_case expected, camelCase in DB)
  - 13 extra columns (camelCase in DB, not in entity)
  - 2 type mismatches (enum issues)

### After Migration:
- ✅ 14 entities verified
- ✅ 0 issues found
- ✅ All column names match entities
- ✅ All enum types correct

---

## 🎯 Summary Checklist

- [ ] Review migration files
- [ ] Backup database
- [ ] Run migration (`013-fix-all-schema-mismatches.sql`)
- [ ] Verify schema (`npm run verify:schema`)
- [ ] Test application
- [ ] Check for errors
- [ ] Document any issues

---

## 🚀 After Migration

Once migration is complete and verified:

1. **Update Seed Script** (if needed)
   - The seed script should now work correctly with snake_case columns

2. **Run Seed Script**:
   ```bash
   npm run seed:test-users
   ```

3. **Test APIs**:
   ```bash
   npm run test:hms
   npm run test:hms:create
   ```

4. **Continue Development**:
   - All HMS features should work correctly
   - Schema verification can be run regularly
   - Future migrations will follow the same pattern

---

**Status**: ✅ **READY TO EXECUTE**

**Next Action**: Review migrations → Backup → Run → Verify

