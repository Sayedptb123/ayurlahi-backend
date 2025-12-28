# Test User Credentials

**⚠️ FOR DEVELOPMENT/TESTING ONLY - DO NOT USE IN PRODUCTION**

## Common Password
All test accounts use the password: `Test@123`

## Test Accounts



## Quick Login

1. Navigate to: http://localhost:5173
2. Use any of the email addresses above
3. Password: `Test@123`

## API Testing

You can use these credentials to test API endpoints:

```bash
# Login example
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@medilink.com", "password": "Test@123"}'
```

## Account Details

| Email | Role | Organization | Password |
|-------|------|--------------|----------|


---
*Generated on: 12/28/2025, 7:15:26 PM*
*Script: seed-test-users.js*
