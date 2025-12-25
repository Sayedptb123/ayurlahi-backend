# Database Setup Guide for New Mac

Complete step-by-step guide to set up the database on a new Mac.

## Prerequisites

1. **PostgreSQL** - Database server
2. **Redis** - For background jobs (optional but recommended)
3. **Node.js** - For running the application

---

## Step 1: Install PostgreSQL

### Option A: Using Homebrew (Recommended)

```bash
# Install PostgreSQL
brew install postgresql@14

# Start PostgreSQL service
brew services start postgresql@14

# Verify installation
psql --version
```

### Option B: Using Postgres.app

1. Download from: https://postgresapp.com/
2. Install and launch the app
3. Click "Initialize" to create a new server

### Verify PostgreSQL is Running

```bash
# Check if PostgreSQL is running
psql -U postgres -c "SELECT version();"

# If it asks for a password, you may need to set one or use:
psql -U postgres -d postgres
```

---

## Step 2: Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create the database
CREATE DATABASE ayurlahi;

# Verify database was created
\l

# Exit psql
\q
```

**Alternative (one-liner):**
```bash
createdb -U postgres ayurlahi
```

---

## Step 3: Install Redis (Optional but Recommended)

```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

---

## Step 4: Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Copy from template if exists, or create new
touch .env
```

Add the following to `.env`:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=          # Leave empty if no password, or set your PostgreSQL password
DB_NAME=ayurlahi

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=dev-secret-key-min-32-chars-long-change-in-production-abc123
JWT_EXPIRES_IN=24h

# Application Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

**Generate a secure JWT_SECRET:**
```bash
openssl rand -base64 32
```

---

## Step 5: Run Database Migrations

The project uses SQL migration files. Run them in order:

### Option A: Run All HMS Migrations (Recommended)

```bash
# Run the complete HMS migration (creates all tables)
psql -U postgres -d ayurlahi -f migrations/009-create-all-hms-tables-complete.sql
```

### Option B: Run Migrations Individually

```bash
# Run migrations in order
psql -U postgres -d ayurlahi -f migrations/001-create-hms-patients-table.sql
psql -U postgres -d ayurlahi -f migrations/002-create-hms-doctors-table.sql
psql -U postgres -d ayurlahi -f migrations/003-create-hms-appointments-table.sql
psql -U postgres -d ayurlahi -f migrations/004-create-hms-medical-records-table.sql
psql -U postgres -d ayurlahi -f migrations/005-create-hms-prescriptions-tables.sql
psql -U postgres -d ayurlahi -f migrations/006-create-hms-lab-reports-tables.sql
psql -U postgres -d ayurlahi -f migrations/007-create-hms-patient-billing-tables.sql
```

### Option C: Run Schema Fix Migrations (If needed)

If you encounter schema mismatches, run these:

```bash
# Fix users table column names (snake_case)
psql -U postgres -d ayurlahi -f migrations/010-fix-users-table-column-names.sql

# Fix patient gender enum
psql -U postgres -d ayurlahi -f migrations/011-fix-patient-gender-enum.sql

# Fix user role enum
psql -U postgres -d ayurlahi -f migrations/012-fix-user-role-enum.sql

# Or run the combined fix
psql -U postgres -d ayurlahi -f migrations/013-fix-all-schema-mismatches.sql
```

### Option D: Add Missing Columns (If needed)

```bash
# Add missing users table columns
psql -U postgres -d ayurlahi -f migrations/014-add-missing-users-columns.sql
```

**With Password:**
If PostgreSQL requires a password, use:
```bash
PGPASSWORD=your_password psql -U postgres -d ayurlahi -f migrations/009-create-all-hms-tables-complete.sql
```

---

## Step 6: Verify Database Setup

### Check Tables Were Created

```bash
# Connect to database
psql -U postgres -d ayurlahi

# List all tables
\dt

# Check specific tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

# Exit
\q
```

**Expected Tables:**
- `users`
- `clinics`
- `patients`
- `doctors`
- `appointments`
- `medical_records`
- `prescriptions`
- `prescription_items`
- `lab_reports`
- `lab_report_tests`
- `patient_bills`
- `bill_items`
- `payments`
- `staff` (if staff module is implemented)
- Other existing tables

### Verify Schema

```bash
# Run verification script (if available)
npm run verify:hms
```

---

## Step 7: Create Test Users (Optional)

Create test users for different roles:

```bash
# Run the seed script
npm run seed:test-users
```

This creates test users:
- `admin@test.com` / `abc123123` (Admin role)
- `clinic1@test.com` / `abc123123` (Clinic role)
- `staff1@test.com` / `abc123123` (Staff role)
- `manufacturer1@test.com` / `abc123123` (Manufacturer role)

---

## Step 8: Install Dependencies and Start Application

```bash
# Install Node.js dependencies
npm install

# Start the application in development mode
npm run start:dev
```

The application should connect to the database automatically.

---

## Troubleshooting

### Issue 1: PostgreSQL Connection Failed

**Error:** `ECONNREFUSED` or `password authentication failed`

**Solutions:**
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Start PostgreSQL if not running
brew services start postgresql@14

# Test connection
psql -U postgres -d ayurlahi -c "SELECT 1;"

# If password is required, update .env with DB_PASSWORD
```

### Issue 2: Database Does Not Exist

**Error:** `database "ayurlahi" does not exist`

**Solution:**
```bash
# Create the database
createdb -U postgres ayurlahi

# Or using psql
psql -U postgres -c "CREATE DATABASE ayurlahi;"
```

### Issue 3: Table Already Exists

**Error:** `relation "patients" already exists`

**Solution:**
```bash
# Check what tables exist
psql -U postgres -d ayurlahi -c "\dt"

# If you want to start fresh, drop and recreate:
psql -U postgres -d ayurlahi -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Then run migrations again
```

### Issue 4: Permission Denied

**Error:** `permission denied for database ayurlahi`

**Solution:**
```bash
# Grant permissions to postgres user
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ayurlahi TO postgres;"

# Or create a specific user
psql -U postgres -c "CREATE USER ayurlahi_user WITH PASSWORD 'your_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ayurlahi TO ayurlahi_user;"
```

### Issue 5: Redis Connection Failed

**Error:** `ECONNREFUSED ::1:6379`

**Solution:**
```bash
# Start Redis
brew services start redis

# Verify
redis-cli ping
```

### Issue 6: JWT_SECRET Too Short

**Error:** `JwtStrategy requires a secret or key`

**Solution:**
```bash
# Generate a new secret
openssl rand -base64 32

# Update .env with the generated secret
```

---

## Quick Setup Script

Create a setup script to automate the process:

```bash
#!/bin/bash
# save as setup-db.sh

echo "🚀 Setting up database..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL not found. Installing..."
    brew install postgresql@14
    brew services start postgresql@14
fi

# Check if database exists
if psql -U postgres -lqt | cut -d \| -f 1 | grep -qw ayurlahi; then
    echo "✅ Database 'ayurlahi' already exists"
else
    echo "📦 Creating database 'ayurlahi'..."
    createdb -U postgres ayurlahi
fi

# Run migrations
echo "📋 Running migrations..."
psql -U postgres -d ayurlahi -f migrations/009-create-all-hms-tables-complete.sql

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=
DB_NAME=ayurlahi
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=24h
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
EOF
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

echo "✅ Database setup complete!"
```

Make it executable and run:
```bash
chmod +x setup-db.sh
./setup-db.sh
```

---

## Verification Checklist

After setup, verify everything works:

- [ ] PostgreSQL is running: `psql -U postgres -c "SELECT 1;"`
- [ ] Database exists: `psql -U postgres -l | grep ayurlahi`
- [ ] Tables created: `psql -U postgres -d ayurlahi -c "\dt"`
- [ ] Redis is running: `redis-cli ping`
- [ ] `.env` file exists and has correct values
- [ ] Application starts: `npm run start:dev`
- [ ] Can connect to database from application (check logs)

---

## Next Steps

1. **Create Test Users**: Run `npm run seed:test-users`
2. **Test API**: Use the test scripts or Postman
3. **Start Development**: `npm run start:dev`
4. **Frontend Setup**: Set up the frontend project separately

---

## Additional Resources

- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **Redis Documentation**: https://redis.io/documentation
- **Environment Variables**: See `ENV_FILE_GUIDE.md`
- **API Documentation**: See `HMS_API_DOCUMENTATION.md`

---

## Need Help?

If you encounter issues:

1. Check the error message carefully
2. Verify all prerequisites are installed
3. Check PostgreSQL and Redis are running
4. Verify `.env` file has correct values
5. Check database logs: `tail -f /usr/local/var/log/postgres.log` (Homebrew) or check Postgres.app logs

