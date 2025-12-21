# Database Seed Scripts

## Seed Admin User

### Option 1: Using TypeScript Script (Recommended)

This script uses the application's bcrypt hashing to ensure consistency:

```bash
# Set custom password (optional, defaults to "Admin@123")
export ADMIN_PASSWORD="YourSecurePassword"

# Run the seed script
npm run seed:admin
```

**Default credentials:**
- Email: `admin@ayurlahi.com`
- Password: `Admin@123` (or whatever you set in `ADMIN_PASSWORD`)

### Option 2: Using SQL Directly

If you prefer to use SQL directly:

```bash
# Generate a password hash first
node -e "const bcrypt=require('bcrypt');bcrypt.hash('YourPassword',10).then(h=>console.log(h))"

# Then run the SQL file
psql -U postgres -d ayurlahi -f scripts/seed-admin.sql
```

Or manually edit `scripts/seed-admin.sql` with your generated hash, then run:

```bash
psql -U postgres -d ayurlahi -f scripts/seed-admin.sql
```

### Verify Admin User

After seeding, verify the user was created:

```bash
psql -U postgres -d ayurlahi -c "SELECT id, email, \"firstName\", \"lastName\", role, \"isActive\" FROM users WHERE email = 'admin@ayurlahi.com';"
```





