# Database Setup Guide

## 🎯 Quick Setup (macOS)

### Step 1: Install PostgreSQL (if not installed)

```bash
# Using Homebrew
brew install postgresql@14

# Start PostgreSQL service
brew services start postgresql@14
```

### Step 2: Create PostgreSQL User

The error `role "postgres" does not exist` means you need to create the user. Choose one option:

**Option A: Create `postgres` user (Recommended)**
```bash
createuser -s postgres
```

**Option B: Use your system username**
```bash
# Check your username
whoami

# Then update your .env file:
# DB_USERNAME=your_username
# DB_PASSWORD=  (leave empty if no password)
```

### Step 3: Create the Database

```bash
# Create database named 'ayurlahi'
createdb ayurlahi

# Or if using postgres user:
createdb -U postgres ayurlahi
```

### Step 4: Verify Setup

```bash
# Check PostgreSQL is running
pg_isready

# Connect to database
psql -U postgres -d ayurlahi

# Or if using your username:
psql -d ayurlahi
```

### Step 5: Configure Environment

Create or update your `.env` file:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=  # Leave empty if no password, or set your password
DB_NAME=ayurlahi
NODE_ENV=development
```

### Step 6: Start Your Application

```bash
npm run start:dev
```

**TypeORM will automatically create all tables** because `synchronize: true` is enabled in development mode.

---

## 🔧 Alternative: Manual Setup via psql

If the command-line tools don't work, use `psql` directly:

```bash
# Connect to PostgreSQL
psql postgres

# In PostgreSQL shell, run:
CREATE USER postgres WITH SUPERUSER PASSWORD 'your_password';
CREATE DATABASE ayurlahi OWNER postgres;

# Exit
\q
```

Then update `.env`:
```env
DB_USERNAME=postgres
DB_PASSWORD=your_password
```

---

## 🐧 Linux Setup (Ubuntu/Debian)

```bash
# Install PostgreSQL
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL shell:
CREATE DATABASE ayurlahi;
\q

# Verify
psql -U postgres -d ayurlahi
```

---

## 🪟 Windows Setup

1. **Download PostgreSQL**: https://www.postgresql.org/download/windows/
2. **Install** and remember the password you set for `postgres` user
3. **Open pgAdmin** or Command Prompt
4. **Create database**:
   ```sql
   CREATE DATABASE ayurlahi;
   ```
5. **Update `.env`**:
   ```env
   DB_USERNAME=postgres
   DB_PASSWORD=your_installation_password
   ```

---

## ✅ Verification Checklist

After setup, verify everything works:

```bash
# 1. Check PostgreSQL is running
pg_isready
# Should return: /tmp/.s.PGSQL.5432: accepting connections

# 2. Check database exists
psql -U postgres -l | grep ayurlahi

# 3. Test connection
psql -U postgres -d ayurlahi -c "SELECT version();"

# 4. Start your app
npm run start:dev

# 5. Check logs - should see:
# "TypeORM successfully connected to database"
```

---

## 🐛 Troubleshooting

### Error: `role "postgres" does not exist`

**Solution:**
```bash
# Create the user
createuser -s postgres

# OR use your system username in .env
```

### Error: `database "ayurlahi" does not exist`

**Solution:**
```bash
createdb ayurlahi
# OR
psql -U postgres -c "CREATE DATABASE ayurlahi;"
```

### Error: `password authentication failed`

**Solution:**
1. Check your `.env` has correct password
2. If no password, leave `DB_PASSWORD=` empty
3. Reset password:
   ```bash
   psql -U postgres
   ALTER USER postgres WITH PASSWORD 'new_password';
   ```

### Error: `connection refused`

**Solution:**
```bash
# Check PostgreSQL is running
pg_isready

# If not running, start it:
brew services start postgresql@14  # macOS
sudo systemctl start postgresql     # Linux
```

### Error: `permission denied`

**Solution:**
```bash
# Grant permissions
psql -U postgres
GRANT ALL PRIVILEGES ON DATABASE ayurlahi TO postgres;
\q
```

---

## 📊 What Happens Next?

Once your app starts successfully:

1. **TypeORM automatically creates all tables** (in development mode)
2. **Tables created include:**
   - `users`
   - `clinics`
   - `manufacturers`
   - `products`
   - `orders`
   - `order_items`
   - `payments`
   - `invoices`
   - `subscriptions`
   - `audit_logs`
   - `disputes`
   - `refunds`

3. **You can verify tables:**
   ```bash
   psql -U postgres -d ayurlahi
   \dt  # List all tables
   \q   # Exit
   ```

---

## 🎯 Quick Commands Reference

```bash
# Start PostgreSQL
brew services start postgresql@14

# Stop PostgreSQL
brew services stop postgresql@14

# Check status
pg_isready

# Connect to database
psql -U postgres -d ayurlahi

# List databases
psql -U postgres -l

# Drop database (if needed)
dropdb ayurlahi

# Create database
createdb ayurlahi
```

---

**Once setup is complete, your application will automatically create all database tables on first run!** 🎉





