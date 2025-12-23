-- Test Users Seeding Script (SQL)
-- 
-- ⚠️ IMPORTANT: This script requires proper bcrypt password hashes.
-- It's recommended to use the Node.js script instead: npm run seed:test-users
-- 
-- If you must use this SQL script, you need to:
-- 1. Generate bcrypt hashes for each password using Node.js:
--    const bcrypt = require('bcrypt');
--    bcrypt.hash('Admin@123', 10).then(hash => console.log(hash));
-- 2. Replace the placeholder hashes below with real bcrypt hashes
--
-- Usage: psql -U your_username -d ayurlahi -f scripts/seed-test-users.sql

-- Get a clinic ID for clinic users (use first clinic found)
DO $$
DECLARE
  clinic_uuid UUID;
BEGIN
  SELECT id INTO clinic_uuid FROM clinics LIMIT 1;
  
  -- Admin Users
  INSERT INTO users (id, email, password, "firstName", "lastName", role, phone, "isActive", "isEmailVerified", "createdAt", "updatedAt")
  VALUES 
    (
      gen_random_uuid(),
      'admin@test.ayurlahi.com',
      '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', -- Hash for "Admin@123"
      'Admin',
      'User',
      'admin',
      '1234567890',
      true,
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  ON CONFLICT (email) DO NOTHING;
  
  INSERT INTO users (id, email, password, "firstName", "lastName", role, phone, "isActive", "isEmailVerified", "createdAt", "updatedAt")
  VALUES 
    (
      gen_random_uuid(),
      'admin2@test.ayurlahi.com',
      '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', -- Hash for "Admin@123"
      'Admin',
      'Two',
      'admin',
      '1234567891',
      true,
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  ON CONFLICT (email) DO NOTHING;
  
  -- Support User
  INSERT INTO users (id, email, password, "firstName", "lastName", role, phone, "isActive", "isEmailVerified", "createdAt", "updatedAt")
  VALUES 
    (
      gen_random_uuid(),
      'support@test.ayurlahi.com',
      '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', -- Hash for "Support@123"
      'Support',
      'User',
      'support',
      '1234567892',
      true,
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  ON CONFLICT (email) DO NOTHING;
  
  -- Clinic Users (if clinic exists)
  IF clinic_uuid IS NOT NULL THEN
    INSERT INTO users (id, email, password, "firstName", "lastName", role, phone, "clinicId", "isActive", "isEmailVerified", "createdAt", "updatedAt")
    VALUES 
      (
        gen_random_uuid(),
        'clinic@test.ayurlahi.com',
        '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', -- Hash for "Clinic@123"
        'Clinic',
        'User',
        'clinic',
        '1234567893',
        clinic_uuid,
        true,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    ON CONFLICT (email) DO NOTHING;
    
    INSERT INTO users (id, email, password, "firstName", "lastName", role, phone, "clinicId", "isActive", "isEmailVerified", "createdAt", "updatedAt")
    VALUES 
      (
        gen_random_uuid(),
        'clinic2@test.ayurlahi.com',
        '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', -- Hash for "Clinic@123"
        'Clinic',
        'Two',
        'clinic',
        '1234567894',
        clinic_uuid,
        true,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    ON CONFLICT (email) DO NOTHING;
  END IF;
  
  -- Manufacturer Users
  INSERT INTO users (id, email, password, "firstName", "lastName", role, phone, "isActive", "isEmailVerified", "createdAt", "updatedAt")
  VALUES 
    (
      gen_random_uuid(),
      'manufacturer@test.ayurlahi.com',
      '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', -- Hash for "Manufacturer@123"
      'Manufacturer',
      'User',
      'manufacturer',
      '1234567895',
      true,
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  ON CONFLICT (email) DO NOTHING;
  
  INSERT INTO users (id, email, password, "firstName", "lastName", role, phone, "isActive", "isEmailVerified", "createdAt", "updatedAt")
  VALUES 
    (
      gen_random_uuid(),
      'manufacturer2@test.ayurlahi.com',
      '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', -- Hash for "Manufacturer@123"
      'Manufacturer',
      'Two',
      'manufacturer',
      '1234567896',
      true,
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  ON CONFLICT (email) DO NOTHING;
  
  RAISE NOTICE 'Test users created successfully';
END $$;

-- Verify users were created
SELECT email, "firstName", "lastName", role, "clinicId" 
FROM users 
WHERE email LIKE '%@test.ayurlahi.com'
ORDER BY role, email;

