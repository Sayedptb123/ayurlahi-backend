# How to Run the Staff Table Migration

## Option 1: Using psql Command Line (Recommended)

### Step 1: Open Terminal
Open your terminal/command prompt.

### Step 2: Navigate to Backend Directory
```bash
cd /Users/sayedsuhail/ayurlahi-backend
```

### Step 3: Run the Migration
Replace `your_user` and `ayurlahi` with your actual PostgreSQL username and database name:

```bash
psql -U your_username -d ayurlahi -f migrations/create-staff-table.sql
```

**Example:**
```bash
# If your PostgreSQL username is 'postgres' and database is 'ayurlahi'
psql -U postgres -d ayurlahi -f migrations/create-staff-table.sql

# If you need to specify host and port
psql -U postgres -h localhost -p 5432 -d ayurlahi -f migrations/create-staff-table.sql
```

### Step 4: Enter Password
When prompted, enter your PostgreSQL password.

## Option 2: Using Full Path (From Any Directory)

You can run it from anywhere by using the full path:

```bash
psql -U your_username -d ayurlahi -f /Users/sayedsuhail/ayurlahi-backend/migrations/create-staff-table.sql
```

## Option 3: Using pgAdmin or Another GUI Tool

1. Open pgAdmin (or your preferred PostgreSQL GUI tool)
2. Connect to your database server
3. Navigate to your database (e.g., `ayurlahi`)
4. Right-click on the database → Query Tool
5. Open the file: `migrations/create-staff-table.sql`
6. Click "Execute" or press F5

## Option 4: Copy and Paste SQL Directly

1. Open the file `migrations/create-staff-table.sql`
2. Copy all the SQL content
3. Connect to your database using any PostgreSQL client
4. Paste and execute the SQL

## Finding Your Database Credentials

If you're not sure about your database name or username, check your `.env` file in the backend directory:

```bash
# Look for these variables in .env:
DB_USERNAME=postgres          # This is your username
DB_NAME=ayurlahi              # This is your database name
DB_HOST=localhost             # Usually localhost
DB_PORT=5432                  # Usually 5432
```

## Verify Migration Success

After running the migration, verify the table was created:

```bash
psql -U your_username -d ayurlahi -c "\d staff"
```

Or using SQL:
```sql
SELECT * FROM information_schema.tables WHERE table_name = 'staff';
```

## Troubleshooting

### "command not found: psql"
If you get this error, you need to install PostgreSQL client tools or use the full path to psql:

```bash
# On macOS with Homebrew
brew install postgresql

# On Linux
sudo apt-get install postgresql-client  # Debian/Ubuntu
sudo yum install postgresql             # CentOS/RHEL

# Or use Docker (if you're using Docker for PostgreSQL)
docker exec -i your-postgres-container psql -U postgres -d ayurlahi < migrations/create-staff-table.sql
```

### "password authentication failed"
- Double-check your username and password
- Make sure PostgreSQL is running
- Check your `.env` file for the correct credentials

### "database does not exist"
- Create the database first: `createdb -U your_username ayurlahi`
- Or use the database name from your `.env` file

## Alternative: Use TypeORM Migration System

If your project uses TypeORM migrations, you might want to create a proper migration file instead. However, since `synchronize: false` is set in your app.module.ts, manual SQL execution is appropriate.


