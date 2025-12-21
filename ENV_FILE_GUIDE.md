# .env File Configuration Guide

## Current .env Structure

Your `.env` file should contain these sections:

### 1. Database Configuration (Required)
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=          # Your PostgreSQL password (or leave empty if no password)
DB_NAME=ayurlahi
```

**How to find your PostgreSQL password:**
- If you set it during PostgreSQL installation, use that
- If empty, PostgreSQL might not require a password for local connections
- Check: `psql -U postgres -d ayurlahi` (if it works without password, leave empty)

---

### 2. Redis Configuration (Required for Background Jobs)
```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Status:** ✅ Should be set (Redis is running)

---

### 3. JWT Configuration (Required)
```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars-long
JWT_EXPIRES_IN=24h
```

**Important:**
- `JWT_SECRET` must be at least 32 characters long
- Change this in production!
- Generate a secure secret: `openssl rand -base64 32`

---

### 4. Application Configuration (Required)
```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

**Notes:**
- `PORT`: Backend server port (default: 3000)
- `NODE_ENV`: Set to `production` when deploying
- `FRONTEND_URL`: Your frontend URL for CORS (Vite default: 5173)

---

### 5. Razorpay Configuration (Optional - for Payments)
```env
# Uncomment and fill when ready to use payments
# RAZORPAY_KEY_ID=your_razorpay_key_id
# RAZORPAY_KEY_SECRET=your_razorpay_key_secret
# RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

**When to configure:**
- When you want to test payment features
- Get credentials from: https://razorpay.com/dashboard

**Note:** App will work without this, but payment features will be disabled.

---

### 6. AWS S3 Configuration (Optional - for File Storage)
```env
# Uncomment and fill when ready to use S3
# AWS_ACCESS_KEY_ID=your_aws_access_key
# AWS_SECRET_ACCESS_KEY=your_aws_secret_key
# AWS_REGION=ap-south-1
# AWS_S3_BUCKET=your_bucket_name
```

**When to configure:**
- When you want to store invoices in S3
- Get credentials from AWS IAM

**Note:** App will work without this, but file upload features will be disabled.

---

### 7. WhatsApp Configuration (Optional - for WhatsApp Orders)
```env
# Uncomment and fill when ready to use WhatsApp
# WHATSAPP_API_URL=your_whatsapp_api_url
# WHATSAPP_API_KEY=your_whatsapp_api_key
# WHATSAPP_SOURCE_NAME=your_source_name
```

**When to configure:**
- When you want WhatsApp order ingestion
- Get credentials from Gupshup or Twilio

**Note:** App will work without this, but WhatsApp features will be disabled.

---

## Quick Verification

Check if your .env is configured correctly:

```bash
# Check if file exists
test -f .env && echo "✅ .env exists" || echo "❌ .env missing"

# Check required variables (without showing values)
grep -E "^DB_HOST|^DB_NAME|^JWT_SECRET|^PORT" .env

# Check if JWT_SECRET is set (should be at least 32 chars)
grep "^JWT_SECRET=" .env | awk -F= '{print length($2)}'
```

---

## Common Issues

### Issue 1: JWT_SECRET too short
**Error:** `JwtStrategy requires a secret or key`

**Fix:**
```bash
# Generate a secure secret
openssl rand -base64 32

# Add to .env
JWT_SECRET=<generated-secret>
```

---

### Issue 2: Database connection fails
**Error:** `ECONNREFUSED` or `password authentication failed`

**Check:**
```bash
# Test PostgreSQL connection
psql -U postgres -d ayurlahi -c "SELECT 1;"

# If fails, check your DB_PASSWORD in .env matches PostgreSQL password
```

---

### Issue 3: Redis connection fails
**Error:** `ECONNREFUSED ::1:6379`

**Fix:**
```bash
# Start Redis
brew services start redis

# Verify
redis-cli ping
```

---

### Issue 4: CORS errors
**Error:** `CORS policy: No 'Access-Control-Allow-Origin' header`

**Check:**
```bash
# Verify FRONTEND_URL matches your frontend
grep FRONTEND_URL .env
# Should be: FRONTEND_URL=http://localhost:5173 (or your frontend port)
```

---

## Production Checklist

Before deploying to production:

- [ ] Change `NODE_ENV=production`
- [ ] Set strong `JWT_SECRET` (32+ characters)
- [ ] Set production database credentials
- [ ] Configure `FRONTEND_URL` to production domain
- [ ] Uncomment and configure Razorpay credentials
- [ ] Uncomment and configure AWS S3 credentials
- [ ] Uncomment and configure WhatsApp credentials
- [ ] Set `DB_SSL=true` if using cloud database
- [ ] Review all passwords and secrets

---

## Security Best Practices

1. **Never commit .env to git**
   - Already in `.gitignore` ✅

2. **Use strong secrets**
   - JWT_SECRET: 32+ random characters
   - Database passwords: Strong, unique

3. **Rotate secrets regularly**
   - Especially in production

4. **Use environment-specific files**
   - `.env.development`
   - `.env.production`
   - `.env.local` (for local overrides)

---

## Example .env for Development

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=
DB_NAME=ayurlahi

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=dev-secret-key-min-32-chars-long-change-in-production
JWT_EXPIRES_IN=24h

# App
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Optional (leave commented for now)
# RAZORPAY_KEY_ID=
# RAZORPAY_KEY_SECRET=
# RAZORPAY_WEBHOOK_SECRET=
```

---

## Need Help?

If you're having issues with your .env file:

1. **Check the template:** `env.template`
2. **Verify values:** Make sure all required fields are set
3. **Test connections:** Use the verification commands above
4. **Check logs:** Look at server startup logs for errors

