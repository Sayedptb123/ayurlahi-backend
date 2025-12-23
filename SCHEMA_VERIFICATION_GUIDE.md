# Schema Verification Guide

## Quick Start

### Verify Schema Matches Entities

```bash
npm run verify:schema
```

This will:
1. Build the project (compile entities)
2. Connect to database
3. Compare entity definitions with actual database schema
4. Report any mismatches

---

## What Gets Verified

### Column Names
- ✅ All entity columns exist in database
- ✅ Column names match exactly
- ⚠️ Extra columns in database (warns only)

### Column Types
- ✅ Types are compatible
- ⚠️ Type mismatches (reports but may be acceptable)

### Required Fields
- ✅ Non-nullable columns exist
- ✅ Default values match

---

## Example Output

### Success
```
========================================
Schema Verification Script
========================================

✓ Database connection established

Verifying User entity (table: users)...
  ✓ User schema matches database (15 columns)

========================================
Verification Summary
========================================

✓ All schemas match!
```

### With Issues
```
========================================
Schema Verification Script
========================================

✓ Database connection established

Verifying User entity (table: users)...
  ✗ User has 2 issue(s)

========================================
Verification Summary
========================================

✗ Found 2 issue(s):

MISSING IN DB:
  - Column 'password_hash' (property: passwordHash) exists in entity but not in database

TYPE MISMATCH:
  - Type mismatch for 'phone': entity expects varchar, database has text
```

---

## When to Run

### Before Committing
```bash
npm run verify:schema
```

### After Migrations
```bash
# Run migration
psql -U user -d database -f migrations/XXX-migration.sql

# Verify
npm run verify:schema
```

### In CI/CD
Add to your CI pipeline:
```yaml
- name: Verify Schema
  run: npm run verify:schema
```

---

## Troubleshooting

### "dist folder not found"
**Solution**: Build first
```bash
npm run build
npm run verify:schema
```

### "Unable to connect to database"
**Solution**: Check `.env` file has correct database credentials

### "Entity not found"
**Solution**: Ensure entity is imported in the script and compiled

---

## Next Steps

After verification:
1. Fix any reported issues
2. Update migrations if needed
3. Re-run verification
4. Commit when all checks pass

---

**See Also**: `SCHEMA_CONVENTIONS.md` for detailed conventions

