# Medilink — Database Migration Workflow

> **Source of truth: `baseline-YYYY-MM-DD.sql`** alongside dated incremental `.sql` files.
> TypeORM `migration:run` is **NOT** used — too easy to drift.

---

## Why this layout

Until 2026-05-31 the team had two parallel migration systems:

1. **Manually-applied SQL scripts** referenced in `package.json` (e.g.
   `001-create-organisations-table`, `012-phase10-schema-restructure`).
2. **TypeORM-generated TS migration files** in `src/migrations/`.

Both wrote to the same `migrations` table, but the two lists never lined
up. During the production-readiness audit we found 11 TS migration files
that were not registered in the DB, plus several ad-hoc `ALTER TABLE`
statements that were applied directly to dev.

To eliminate this drift permanently, we reset the migration history to a
**verified schema baseline** captured from the dev DB.

---

## Files in this directory

- **`baseline-2026-05-31.sql`** — `pg_dump --schema-only` of a known-good
  state. Includes all tables, constraints, indexes, sequences, and the
  necessary ALTER TABLEs that were applied during the audit.
  Apply this once to seed a fresh database.

- **`archive/`** — the 11 legacy TypeORM migration files that were either
  never applied or were applied by hand. Kept for historical reference,
  but **not** auto-run. Do not move them back into the parent folder.

- **`_README.md`** — this file.

---

## Deploy procedures

### Fresh DB (new staging / new production)

```bash
createdb medilink
psql medilink -f src/migrations/baseline-2026-05-31.sql
cd ayurlahi-backend
npm run build
npm start
```

That's it. The `migrations` table will contain a single entry
(`Baseline-2026-05-31`) marking the baseline as applied.

### Existing DB (current dev / staging / production)

**No action needed.** The baseline was captured from the live dev DB, so
running it is a no-op for systems already at that schema.

If you have any doubt, you can verify your DB matches the baseline by
re-running it against a temp database and `diff`-ing the resulting
schema with your DB.

---

## Adding a new schema change

After 2026-05-31, all schema changes are made via dated `.sql` files
applied with `psql`. **No more TypeORM migrations.**

1. Create a new file in this folder following the naming convention:

   `YYYY-MM-DD-short-description.sql`

   e.g. `2026-06-15-add-discount-codes.sql`

2. Wrap the change in `BEGIN; ... COMMIT;` and make it idempotent where
   possible (use `IF NOT EXISTS`, `IF EXISTS`, `DROP CONSTRAINT IF EXISTS`,
   etc.).

3. End the file with an `INSERT INTO migrations (name)` recording the
   migration name. Use `ON CONFLICT (name) DO NOTHING` for safety.

4. Apply to dev:

   ```bash
   psql medilink -f src/migrations/2026-06-15-add-discount-codes.sql
   ```

5. Apply to staging/prod via your deployment script (the production
   deploy should run all `*.sql` files in this folder in lexicographic
   order, skipping any whose name already appears in the `migrations`
   table).

### Template

```sql
-- ============================================================================
-- 2026-06-15-add-discount-codes
-- Purpose: Add discount_codes table for marketplace promotions.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."discount_codes" (
  ...
);

INSERT INTO "public"."migrations" ("name")
VALUES ('2026-06-15-add-discount-codes')
ON CONFLICT ("name") DO NOTHING;

COMMIT;
```

---

## Backups before any migration

Always snapshot the DB before applying a migration to production:

```bash
./scripts/backup-db.sh
# verify the backup file exists and is non-trivially sized
psql medilink -f src/migrations/2026-06-15-add-discount-codes.sql
```

If a migration fails midway, restore from the backup:

```bash
./scripts/backup-db.sh --restore /var/backups/ayurlahi/medilink_backup_<timestamp>.sql.gz
```

---

## Why no TypeORM `synchronize: true` ever

Production rule: `synchronize: false` in `app.module.ts`. Auto-sync
silently destroys columns when the entity definition drifts from the
DB. Every schema change goes through this folder.
