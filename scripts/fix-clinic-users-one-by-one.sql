-- Fix Clinic Users - Update One at a Time
-- Updates clinic users one by one to avoid unique constraint violation
-- Usage: psql -U your_username -d ayurlahi -f scripts/fix-clinic-users-one-by-one.sql

-- Step 1: Update first clinic user
UPDATE users 
SET "clinicId" = '6677fd76-4289-4b0d-845f-6e1d7e9f77db'
WHERE email = 'clinic@test.ayurlahi.com'
  AND role = 'clinic';

-- Step 2: Check if first update succeeded
SELECT 
  'After first update:' as info,
  email,
  "clinicId",
  CASE 
    WHEN "clinicId" IS NOT NULL THEN '✓ Has Clinic ID'
    ELSE '✗ Missing Clinic ID'
  END as status
FROM users 
WHERE email = 'clinic@test.ayurlahi.com'
  AND role = 'clinic';

-- Step 3: Try to update second clinic user
-- This might fail if there's a unique constraint preventing multiple users from having the same clinicId
DO $$
BEGIN
  UPDATE users 
  SET "clinicId" = '6677fd76-4289-4b0d-845f-6e1d7e9f77db'
  WHERE email = 'clinic2@test.ayurlahi.com'
    AND role = 'clinic';
  
  RAISE NOTICE 'Successfully updated clinic2@test.ayurlahi.com';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Cannot assign same clinicId to clinic2 user due to unique constraint.';
  RAISE NOTICE 'This means only one user can have this clinicId.';
  RAISE NOTICE 'clinic@test.ayurlahi.com has been updated and can be used for testing.';
END $$;

-- Step 4: Final verification
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

