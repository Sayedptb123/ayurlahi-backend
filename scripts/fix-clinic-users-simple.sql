-- Fix Clinic Users - Simple Version
-- Assigns clinicId to clinic users, handling existing assignments
-- Usage: psql -U your_username -d ayurlahi -f scripts/fix-clinic-users-simple.sql

-- First, check what users already have this clinicId
SELECT 
  'Users with clinicId:' as info,
  email,
  role,
  "clinicId"
FROM users 
WHERE "clinicId" = '6677fd76-4289-4b0d-845f-6e1d7e9f77db';

-- Check clinic users that need clinicId
SELECT 
  'Clinic users needing clinicId:' as info,
  email,
  role,
  "clinicId"
FROM users 
WHERE role = 'clinic' 
  AND email LIKE '%@test.ayurlahi.com';

-- Solution: Assign clinic users to the same clinic (if constraint allows)
-- OR: Check if we need to remove the unique constraint
-- For now, let's try to update one at a time

-- Update first clinic user
UPDATE users 
SET "clinicId" = '6677fd76-4289-4b0d-845f-6e1d7e9f77db'
WHERE email = 'clinic@test.ayurlahi.com'
  AND role = 'clinic'
  AND ("clinicId" IS NULL OR "clinicId" != '6677fd76-4289-4b0d-845f-6e1d7e9f77db');

-- If there's a unique constraint preventing multiple users from having the same clinicId,
-- we need to check the database schema. For now, try updating the second one too.
-- If it fails, we'll know there's a unique constraint.

-- Update second clinic user (might fail if unique constraint exists)
DO $$
BEGIN
  UPDATE users 
  SET "clinicId" = '6677fd76-4289-4b0d-845f-6e1d7e9f77db'
  WHERE email = 'clinic2@test.ayurlahi.com'
    AND role = 'clinic'
    AND ("clinicId" IS NULL OR "clinicId" != '6677fd76-4289-4b0d-845f-6e1d7e9f77db';
  
  RAISE NOTICE 'Updated clinic2 user';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Cannot assign same clinicId to multiple users due to unique constraint.';
  RAISE NOTICE 'This is unusual - typically multiple users should be able to belong to the same clinic.';
  RAISE NOTICE 'You may need to check the database schema or create another clinic.';
END $$;

-- Verify results
SELECT 
  'Final State:' as info,
  email, 
  role,
  "clinicId",
  CASE 
    WHEN "clinicId" IS NOT NULL THEN '✓ Has Clinic ID'
    ELSE '✗ Missing Clinic ID'
  END as status
FROM users 
WHERE role = 'clinic' 
  AND email LIKE '%@test.ayurlahi.com'
ORDER BY email;

