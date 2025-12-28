# Run Disputes & Invoices Migration

## Quick Fix

The `disputes` table doesn't exist in your database. Run this migration to create it:

### Option 1: Using psql (Recommended)

```bash
# Replace 'your_username' with your PostgreSQL username
psql -U your_username -d ayurlahi -f migrations/021-create-market-support-tables.sql
```

**If you need a password:**
```bash
PGPASSWORD=your_password psql -U your_username -d ayurlahi -f migrations/021-create-market-support-tables.sql
```

### Option 2: Using Environment Variables

```bash
# If you have DB credentials in .env
source .env
psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $DB_NAME -f migrations/021-create-market-support-tables.sql
```

### Option 3: Interactive psql

```bash
psql -U your_username -d ayurlahi
```

Then in psql:
```sql
\i migrations/021-create-market-support-tables.sql
\q
```

---

## What This Migration Creates

1. **Disputes Table** (`disputes`)
   - Stores order disputes
   - Required for analytics dashboard

2. **Invoices Table** (`invoices`)
   - Stores invoice information
   - Links to orders

---

## Verify Migration

After running the migration, verify the tables exist:

```bash
psql -U your_username -d ayurlahi -c "\d disputes"
psql -U your_username -d ayurlahi -c "\d invoices"
```

You should see the table structures.

---

## Temporary Fix (Already Applied)

The analytics service has been updated to handle missing tables gracefully:
- If `disputes` table doesn't exist, it returns `0` for pending disputes
- The dashboard will work, but will show `0` pending disputes until you run the migration

---

## After Migration

Once you run the migration:
1. The analytics dashboard will work correctly
2. The disputes endpoint will work
3. You can create and manage disputes

---

**Note**: The migration uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times.

