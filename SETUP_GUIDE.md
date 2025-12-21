# Infrastructure Setup Guide

## 🔧 Required Services

Your application needs the following services to run:

1. **PostgreSQL** - Database
2. **Redis** - Queue management (BullMQ)

## 📋 Setup Instructions

### 1. PostgreSQL Setup

#### On macOS (using Homebrew):

```bash
# Install PostgreSQL
brew install postgresql@14

# Start PostgreSQL service
brew services start postgresql@14

# Create the database user (if it doesn't exist)
createuser -s postgres

# Or create a custom user
createuser -s your_username

# Create the database
createdb ayurlahi
```

#### On Linux (Ubuntu/Debian):

```bash
# Install PostgreSQL
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Switch to postgres user and create database
sudo -u postgres psql

# In PostgreSQL shell:
CREATE USER postgres WITH PASSWORD 'your_password';
ALTER USER postgres CREATEDB;
CREATE DATABASE ayurlahi;
\q
```

#### On Windows:

1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Install and set a password for the `postgres` user
3. Use pgAdmin or psql to create the database:
   ```sql
   CREATE DATABASE ayurlahi;
   ```

#### Verify PostgreSQL:

```bash
# Check if PostgreSQL is running
pg_isready

# Connect to PostgreSQL
psql -U postgres -d ayurlahi
```

### 2. Redis Setup

#### On macOS (using Homebrew):

```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Or run Redis manually
redis-server
```

#### On Linux (Ubuntu/Debian):

```bash
# Install Redis
sudo apt-get update
sudo apt-get install redis-server

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

#### On Windows:

1. Download Redis from https://github.com/microsoftarchive/redis/releases
2. Or use WSL (Windows Subsystem for Linux)
3. Or use Docker: `docker run -d -p 6379:6379 redis`

#### Verify Redis:

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG
```

### 3. Environment Configuration

Update your `.env` file with the correct credentials:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres  # Or your PostgreSQL username
DB_PASSWORD=your_password  # Your PostgreSQL password
DB_NAME=ayurlahi

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# Application
PORT=3000
NODE_ENV=development

# Optional: Razorpay (for payment features)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Optional: AWS S3 (for file storage)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your_bucket_name

# Optional: WhatsApp (for WhatsApp ordering)
WHATSAPP_API_URL=your_whatsapp_api_url
WHATSAPP_API_KEY=your_whatsapp_api_key
WHATSAPP_SOURCE_NAME=your_source_name
```

## 🚀 Quick Start Commands

### Start all services (macOS with Homebrew):

```bash
# Terminal 1: Start PostgreSQL
brew services start postgresql@14

# Terminal 2: Start Redis
brew services start redis

# Terminal 3: Start your application
npm run start:dev
```

### Check service status:

```bash
# Check PostgreSQL
pg_isready

# Check Redis
redis-cli ping

# Check if ports are in use
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
```

## 🐛 Troubleshooting

### PostgreSQL Issues

**Error: `role "postgres" does not exist`**

Solution:
```bash
# Create the postgres user
createuser -s postgres

# Or use your system username
# Update .env: DB_USERNAME=your_username
```

**Error: `database "ayurlahi" does not exist`**

Solution:
```bash
createdb ayurlahi
# Or
psql -U postgres -c "CREATE DATABASE ayurlahi;"
```

**Error: `password authentication failed`**

Solution:
- Check your `.env` file has the correct password
- Reset PostgreSQL password:
  ```bash
  psql -U postgres
  ALTER USER postgres WITH PASSWORD 'new_password';
  ```

### Redis Issues

**Error: `ECONNREFUSED 127.0.0.1:6379`**

Solution:
```bash
# Start Redis
brew services start redis  # macOS
# OR
sudo systemctl start redis-server  # Linux
# OR
redis-server  # Manual start
```

**Error: `Redis connection failed`**

Solution:
- Check Redis is running: `redis-cli ping`
- Check port 6379 is not blocked by firewall
- Verify `REDIS_HOST` and `REDIS_PORT` in `.env`

## ✅ Verification Checklist

Before running the application, verify:

- [ ] PostgreSQL is installed and running
- [ ] PostgreSQL user exists (check with `psql -U postgres`)
- [ ] Database `ayurlahi` exists
- [ ] Redis is installed and running
- [ ] `.env` file is configured with correct credentials
- [ ] All environment variables are set

## 🎯 Next Steps

Once services are running:

1. Run database migrations:
   ```bash
   npm run migration:run
   # Or if using TypeORM CLI:
   npm run typeorm migration:run
   ```

2. Start the application:
   ```bash
   npm run start:dev
   ```

3. Test the API:
   ```bash
   curl http://localhost:3000/api
   ```

## 📚 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [NestJS TypeORM](https://docs.nestjs.com/techniques/database)
- [BullMQ Documentation](https://docs.bullmq.io/)





