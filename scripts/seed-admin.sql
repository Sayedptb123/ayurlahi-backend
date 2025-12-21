-- Seed Admin User
-- This SQL matches the actual User entity schema
-- Default password: Admin@123 (change this hash if you want a different password)

-- First, generate a password hash using bcrypt for your desired password
-- You can use: node -e "const bcrypt=require('bcrypt');bcrypt.hash('YourPassword',10).then(h=>console.log(h))"

INSERT INTO users (
  id,
  email, 
  password,
  "firstName",
  "lastName",
  role,
  "isActive",
  "isEmailVerified",
  phone,
  "whatsappNumber",
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid(),
  'admin@ayurlahi.com', 
  '$2b$10$dnm7ufVmcO9KcDFmTr6sl.UNb2wdYnybUT6Lfr2yfWr/W1uwh16Y.', -- Password: Admin@123
  'System', 
  'Administrator',
  'admin',
  true,
  true,
  NULL,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Verify the user was created
SELECT id, email, "firstName", "lastName", role, "isActive", "createdAt" 
FROM users 
WHERE email = 'admin@ayurlahi.com';

