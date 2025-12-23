# Database Schema Conventions

## Overview

This document defines the conventions and best practices for managing database schema in this project.

---

## Naming Conventions

### Column Names
- **Format**: `snake_case` (lowercase with underscores)
- **Examples**: `password_hash`, `first_name`, `is_active`, `created_at`
- **Rationale**: PostgreSQL convention, matches existing database schema

### Table Names
- **Format**: `snake_case` (lowercase with underscores)
- **Examples**: `users`, `patient_bills`, `lab_reports`
- **Rationale**: PostgreSQL convention, matches existing database schema

### Entity Properties (TypeScript)
- **Format**: `camelCase`
- **Examples**: `passwordHash`, `firstName`, `isActive`, `createdAt`
- **Rationale**: TypeScript/JavaScript convention

---

## Entity Definition Rules

### 1. Always Use Explicit Column Names

**✅ Good:**
```typescript
@Column({ name: 'password_hash' })
passwordHash: string;
```

**❌ Bad:**
```typescript
@Column()
passwordHash: string; // Relies on naming strategy, can cause issues
```

### 2. Match Database Schema Exactly

- Entity column names must match actual database column names
- Use `@Column({ name: 'exact_db_column_name' })` to ensure match
- Verify with schema verification script before committing

### 3. Document Nullable Fields

**✅ Good:**
```typescript
@Column({ type: 'varchar', nullable: true })
phone: string | null;
```

**❌ Bad:**
```typescript
@Column({ nullable: true })
phone: string; // Missing type, TypeORM may infer incorrectly
```

---

## Schema Management Strategy

### Current Approach

1. **TypeORM Entities**: Source of truth for schema definition
2. **Raw SQL Migrations**: Used for HMS tables (in `migrations/` folder)
3. **Synchronize**: Disabled (`synchronize: false`) to prevent auto-changes
4. **Naming Strategy**: Custom strategy converts camelCase → snake_case

### Migration Process

#### For New Tables (HMS)
1. Create entity with explicit column names
2. Create SQL migration file in `migrations/` folder
3. Run migration: `psql -U user -d database -f migrations/XXX-migration.sql`
4. Verify with schema verification script

#### For Existing Tables
1. Update entity definition
2. Create migration SQL file
3. Test migration on development database
4. Run migration on production
5. Verify with schema verification script

---

## Schema Verification

### Run Verification Script

```bash
# Build first
npm run build

# Run verification
node scripts/verify-schema.js
```

### What It Checks

- ✅ Column names match between entity and database
- ✅ Column types are compatible
- ✅ Required columns exist
- ⚠️ Extra columns in database (warns, doesn't fail)

### When to Run

- Before committing entity changes
- After running migrations
- Before deploying to production
- In CI/CD pipeline (recommended)

---

## Seed Scripts Best Practices

### ❌ Don't Hardcode Column Names

```javascript
// BAD - Hardcoded column names
const sql = `
  INSERT INTO users (email, password_hash, first_name, ...)
  VALUES (...)
`;
```

### ✅ Use Entity Metadata

```javascript
// GOOD - Get column names from entity
const { getEntityColumnNames, generateInsertSQL } = require('./get-entity-column-names');
const columnMap = getEntityColumnNames(dataSource, User);
const { sql, values } = generateInsertSQL(columnMap, 'users', userData);
```

### Benefits

- ✅ Always uses correct column names
- ✅ Works even if entity changes
- ✅ No manual updates needed
- ✅ Prevents column name mismatches

---

## Common Issues and Solutions

### Issue: Column Name Mismatch

**Symptom**: `ERROR: column "column_name" does not exist`

**Cause**: Script uses different column name than database

**Solution**:
1. Check actual database schema: `\d table_name` in psql
2. Update script to use correct column name
3. Or use entity metadata (recommended)

### Issue: Type Mismatch

**Symptom**: `DataTypeNotSupportedError: Data type "Object" is not supported`

**Cause**: Missing explicit type in `@Column` decorator

**Solution**:
```typescript
// Add explicit type
@Column({ type: 'varchar', nullable: true })
phone: string | null;
```

### Issue: Synchronize Conflicts

**Symptom**: TypeORM tries to change schema unexpectedly

**Solution**: Keep `synchronize: false` in production, use migrations

---

## Development Workflow

### Adding a New Column

1. **Update Entity**
   ```typescript
   @Column({ type: 'varchar', nullable: true, name: 'new_column_name' })
   newColumn: string | null;
   ```

2. **Create Migration**
   ```sql
   ALTER TABLE table_name ADD COLUMN new_column_name VARCHAR;
   ```

3. **Run Migration**
   ```bash
   psql -U user -d database -f migrations/XXX-add-new-column.sql
   ```

4. **Verify Schema**
   ```bash
   npm run build
   node scripts/verify-schema.js
   ```

5. **Update Seed Scripts** (if needed)
   - Use entity metadata, not hardcoded names

### Modifying Existing Column

1. **Update Entity** (if needed)
2. **Create Migration** with ALTER TABLE
3. **Test on Development**
4. **Run on Production**
5. **Verify Schema**

---

## TypeORM Configuration

### Current Settings

```typescript
{
  synchronize: false, // ✅ Disabled - use migrations
  namingStrategy: CustomNamingStrategy, // Converts camelCase → snake_case
  entities: [...], // All entity classes
}
```

### Naming Strategy Behavior

- **Explicit `name` in `@Column`**: Used as-is (recommended)
- **No `name` specified**: Converts camelCase → snake_case automatically
- **Example**: `passwordHash` → `password_hash` (if no explicit name)

---

## Verification Checklist

Before committing schema changes:

- [ ] Entity uses explicit `name` in `@Column` decorators
- [ ] Migration SQL file created (if needed)
- [ ] Schema verification script passes
- [ ] Seed scripts use entity metadata (not hardcoded names)
- [ ] Documentation updated (if needed)

---

## Tools and Scripts

### Available Scripts

- `scripts/verify-schema.js` - Verify schema matches entities
- `scripts/get-entity-column-names.js` - Get column names from entities
- `migrations/*.sql` - SQL migration files

### Future Improvements

- [ ] TypeORM migration system integration
- [ ] Automated schema tests
- [ ] CI/CD schema verification
- [ ] Schema documentation generator

---

## References

- [TypeORM Migrations](https://typeorm.io/migrations)
- [TypeORM Naming Strategy](https://typeorm.io/naming-strategy)
- [PostgreSQL Naming Conventions](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS)

---

**Last Updated**: December 24, 2025  
**Maintained By**: Development Team

