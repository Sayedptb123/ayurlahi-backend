# Test Users Created

## Test Accounts

All test users have been created with password: **abc123123**

### Accounts Created:

1. **Admin User**
   - Email: `admin@test.com`
   - Password: `abc123123`
   - Role: `admin`
   - Phone: `1234567890`

2. **Support User**
   - Email: `support@test.com`
   - Password: `abc123123`
   - Role: `support`
   - Phone: `1234567891`

3. **Clinic User**
   - Email: `clinic@test.com`
   - Password: `abc123123`
   - Role: `clinic`
   - Phone: `1234567892`

4. **Manufacturer User**
   - Email: `manufacturer@test.com`
   - Password: `abc123123`
   - Role: `manufacturer`
   - Phone: `1234567893`

## How to Create Test Users

Run the seed script:

```bash
npm run seed:test-users
```

## Usage

You can now use these accounts to test the HMS system:

```bash
# Login as admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "abc123123"
  }'

# Login as clinic user
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "clinic@test.com",
    "password": "abc123123"
  }'
```

## Notes

- All users are active (`is_active: true`)
- All users have verified emails (`is_email_verified: true`)
- Users are created with all required fields
- If a user already exists, the script will skip creating it

