# Quick Database Setup

## 🚀 Fastest Way to Setup Database

### Option 1: Use the Setup Script (Recommended)

```bash
# Make script executable (if not already)
chmod +x setup-db.sh

# Run the setup script
./setup-db.sh
```

The script will:
- ✅ Check if PostgreSQL is installed
- ✅ Start PostgreSQL if not running
- ✅ Create the `postgres` user if needed
- ✅ Create the `ayurlahi` database
- ✅ Verify the connection
- ✅ Create `.env` file if missing

### Option 2: Manual Setup (3 Commands)

```bash
# 1. Start PostgreSQL
brew services start postgresql@14

# 2. Create user (if needed)
createuser -s postgres

# 3. Create database
createdb -U postgres ayurlahi
```

### Option 3: Use Your System Username

If `postgres` user doesn't work, use your username:

```bash
# 1. Start PostgreSQL
brew services start postgresql@14

# 2. Create database with your username
createdb ayurlahi

# 3. Update .env file:
# DB_USERNAME=sayedsuhail
# DB_PASSWORD=
```

## 📝 Create/Update .env File

```bash
# Copy example file
cp .env.example .env

# Edit .env and set:
DB_USERNAME=postgres  # or your username
DB_PASSWORD=          # leave empty if no password
DB_NAME=ayurlahi
```

## ✅ Verify Setup

```bash
# Check PostgreSQL is running
pg_isready

# Test database connection
psql -U postgres -d ayurlahi -c "SELECT 'Database ready!';"
```

## 🎯 Start Your App

```bash
npm run start:dev
```

TypeORM will automatically create all tables! 🎉

---

**That's it! Your database is ready.**





