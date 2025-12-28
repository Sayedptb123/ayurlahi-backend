# Test Account Credentials

**⚠️ FOR DEVELOPMENT/TESTING ONLY - DO NOT USE IN PRODUCTION**

## Common Password
All test accounts use the password: `abc123123`

---

## Test Accounts by Organization

### Ayurlahi Team (Super Admins & Support)

| Email | Name | Role |
|-------|------|------|
| superadmin1@ayurlahi.com | Super Admin One | SUPER_ADMIN |
| superadmin2@ayurlahi.com | Super Admin Two | SUPER_ADMIN |
| support1@ayurlahi.com | Support User One | SUPPORT |
| support2@ayurlahi.com | Support User Two | SUPPORT |

### Clinic: Ayurveda Wellness Clinic

| Email | Name | Role |
|-------|------|------|
| clinic1.owner@test.com | Rajesh Kumar | OWNER |
| clinic1.doctor@test.com | Dr. Priya Sharma | STAFF |

### Clinic: Holistic Ayurveda Center

| Email | Name | Role |
|-------|------|------|
| clinic2.owner@test.com | Amit Patel | OWNER |
| clinic2.doctor@test.com | Dr. Anjali Reddy | STAFF |

### Manufacturer: Ayurvedic Herbs Ltd

| Email | Name | Role |
|-------|------|------|
| mfg1.owner@test.com | Suresh Gupta | OWNER |
| mfg1.manager@test.com | Deepak Singh | MANAGER |

### Manufacturer: Natural Remedies Pharma

| Email | Name | Role |
|-------|------|------|
| mfg2.owner@test.com | Ramesh Iyer | OWNER |
| mfg2.manager@test.com | Vikram Nair | MANAGER |

---

## Quick Login

1. Navigate to: http://localhost:5173
2. Use any of the email addresses above
3. Password: `abc123123`

## API Testing

You can use these credentials to test API endpoints:

```bash
# Login example
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "superadmin1@ayurlahi.com", "password": "abc123123"}'
```

---

*Generated on: 12/28/2025, 8:55:26 PM*
*Script: seed-enhanced-test-data.ts*
