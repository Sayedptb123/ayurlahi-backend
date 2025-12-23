-- Fix Clinic Users - Final Version
-- Handles unique constraint on clinicId
-- Usage: psql -U your_username -d ayurlahi -f scripts/fix-clinic-users-final.sql

-- Step 1: Check current state
\echo '=== Current State ==='
SELECT 
  email,
  role,
  "clinicId"
FROM users 
WHERE email LIKE '%@test.ayurlahi.com'
ORDER BY role, email;

-- Step 2: Check which user already has the clinicId
\echo ''
\echo '=== User with clinicId ==='
SELECT 
  email,
  role,
  "clinicId"
FROM users 
WHERE "clinicId" = '6677fd76-4289-4b0d-845f-6e1d7e9f77db';

-- Step 3: Get all available clinics
\echo ''
\echo '=== Available Clinics ==='
SELECT 
  id,
  "clinicName"
FROM clinics
ORDER BY "createdAt";

-- Step 4: Fix - Assign clinic users
-- If there's a unique constraint, we'll assign to different clinics or handle it
DO $$
DECLARE
  clinic_uuid UUID := '6677fd76-4289-4b0d-845f-6e1d7e9f77db';
  clinic_uuid_2 UUID;
  existing_user_email TEXT;
BEGIN
  -- Check if someone already has this clinicId
  SELECT email INTO existing_user_email
  FROM users 
  WHERE "clinicId" = clinic_uuid 
  LIMIT 1;
  
  IF existing_user_email IS NOT NULL THEN
    RAISE NOTICE 'User % already has clinicId %.', existing_user_email, clinic_uuid;
    
    -- Try to get a second clinic
    SELECT id INTO clinic_uuid_2
    FROM clinics
    WHERE id != clinic_uuid
    ORDER BY "createdAt"
    LIMIT 1;
    
    IF clinic_uuid_2 IS NOT NULL THEN
      RAISE NOTICE 'Found second clinic: %. Assigning users to different clinics.', clinic_uuid_2;
      
      -- Assign first clinic user to first clinic
      UPDATE users 
      SET "clinicId" = clinic_uuid
      WHERE email = 'clinic@test.ayurlahi.com'
        AND role = 'clinic';
      
      -- Assign second clinic user to second clinic
      UPDATE users 
      SET "clinicId" = clinic_uuid_2
      WHERE email = 'clinic2@test.ayurlahi.com'
        AND role = 'clinic';
    ELSE
      RAISE NOTICE 'Only one clinic available.';
      RAISE NOTICE 'Attempting to assign both users to the same clinic...';
      RAISE NOTICE 'If this fails, there is a unique constraint preventing multiple users from having the same clinicId.';
      
      -- Try to update both (will fail if unique constraint exists)
      BEGIN
        UPDATE users 
        SET "clinicId" = clinic_uuid
        WHERE email IN ('clinic@test.ayurlahi.com', 'clinic2@test.ayurlahi.com')
          AND role = 'clinic';
        
        RAISE NOTICE 'Successfully assigned both users to the same clinic.';
      EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'Unique constraint violation detected.';
        RAISE NOTICE 'Only one user can have this clinicId.';
        RAISE NOTICE 'Assigning only clinic@test.ayurlahi.com...';
        
        -- Assign only the first one
        UPDATE users 
        SET "clinicId" = clinic_uuid
        WHERE email = 'clinic@test.ayurlahi.com'
          AND role = 'clinic';
      END;
    END IF;
  ELSE
    -- No one has this clinicId, safe to assign
    RAISE NOTICE 'No existing user with this clinicId. Assigning both clinic users...';
    
    UPDATE users 
    SET "clinicId" = clinic_uuid
    WHERE email IN ('clinic@test.ayurlahi.com', 'clinic2@test.ayurlahi.com')
      AND role = 'clinic';
  END IF;
END $$;

-- Step 5: Verify results
\echo ''
\echo '=== Final State ==='
SELECT 
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

