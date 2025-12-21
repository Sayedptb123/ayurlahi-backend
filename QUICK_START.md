# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

**Minimum required variables:**
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=ayurlahi

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h

# Application
PORT=3000
NODE_ENV=development
```

### Step 3: Start Services

**Terminal 1 - PostgreSQL:**
```bash
# Ensure PostgreSQL is running
pg_isready
```

**Terminal 2 - Redis:**
```bash
# Start Redis
redis-server
# Or if installed via Homebrew:
brew services start redis
```

**Terminal 3 - Application:**
```bash
npm run start:dev
```

### Step 4: Verify Installation

```bash
# Test health endpoint
curl http://localhost:3000/api

# Should return: {"status":"ok"} or similar
```

### Step 5: Test Authentication

```bash
# Register a user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "role": "clinic"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Save the access_token from response
```

### Step 6: Test Protected Endpoint

```bash
# Replace YOUR_TOKEN with the token from login
curl http://localhost:3000/api/clinics/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## ✅ Success Checklist

- [ ] Dependencies installed
- [ ] Environment configured
- [ ] PostgreSQL running
- [ ] Redis running
- [ ] Server starts without errors
- [ ] Health endpoint responds
- [ ] User registration works
- [ ] User login works
- [ ] Protected endpoint accessible with token

## 🐛 Troubleshooting

### "Cannot connect to database"
- Check PostgreSQL is running: `pg_isready`
- Verify credentials in `.env`
- Check database exists: `psql -U postgres -l`

### "Cannot connect to Redis"
- Check Redis is running: `redis-cli ping`
- Verify Redis port in `.env`

### "Port 3000 already in use"
- Change PORT in `.env`
- Or kill process: `lsof -ti:3000 | xargs kill`

### "JWT secret not found"
- Add `JWT_SECRET` to `.env`
- Use a strong random string

## 📚 Next Steps

1. Read `NEXT_STEPS.md` for detailed roadmap
2. Review `ARCHITECTURE.md` for system design
3. Check `README.md` for full documentation

## 🎯 First Development Tasks

1. **Create a clinic profile**
   ```bash
   POST /api/clinics
   ```

2. **Create a manufacturer profile**
   ```bash
   POST /api/manufacturers
   ```

3. **Create a product**
   ```bash
   POST /api/products
   ```

4. **Create an order**
   ```bash
   POST /api/orders
   ```

5. **Initiate payment**
   ```bash
   POST /api/payments/initiate/:orderId
   ```

---

**You're all set! Happy coding! 🎉**





