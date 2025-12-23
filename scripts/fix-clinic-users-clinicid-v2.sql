-- Fix Clinic Users - Assign Clinic ID (Version 2)
-- Handles case where clinicId might already be assigned to another user
-- Usage: psql -U your_username -d ayurlahi -f scripts/fix-clinic-users-clinicid-v2.sql

-- First, check current state
SELECT 
  'Current State:' as info,
  email, 
  role,
  "clinicId"
FROM users 
WHERE email LIKE '%@test.ayurlahi.com'
ORDER BY role, email;

-- Get all available clinics
SELECT 
  'Available Clinics:' as info,
  id as clinic_id,
  name as clinic_name
FROM clinics
ORDER BY "createdAt"
LIMIT 5;

-- Fix clinic users by assigning them to different clinics or the same clinic
-- If there's a unique constraint, we'll assign them to different clinics
DO $$
DECLARE
  clinic_uuid UUID;
  clinic_uuid_2 UUID;
  updated_count INTEGER;
  clinic_count INTEGER;
BEGIN
  -- Count available clinics
  SELECT COUNT(*) INTO clinic_count FROM clinics;
  
  IF clinic_count = 0 THEN
    RAISE NOTICE 'No clinics found. Please create a clinic first.';
    RETURN;
  END IF;
  
  -- Get first clinic
  SELECT id INTO clinic_uuid FROM clinics ORDER BY "createdAt" LIMIT 1;
  RAISE NOTICE 'Using clinic ID: %', clinic_uuid;
  
  -- Check if there's already a user with this clinicId
  IF EXISTS (SELECT 1 FROM users WHERE "clinicId" = clinic_uuid AND role = 'clinic' LIMIT 1) THEN
    RAISE NOTICE 'Clinic ID already assigned to another user. Checking for alternative...';
    
    -- Try to find a clinic without a clinic user, or use the same one
    -- For now, we'll just assign both to the same clinic (if constraint allows)
    -- Or assign to different clinics if multiple exist
    
    -- Get second clinic if available
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
      WHERE role = 'clinic' 
        AND "clinicId" IS NULL
        AND email = 'clinic@test.ayurlahi.com';
      
      -- Assign second clinic user to second clinic
      UPDATE users 
      SET "clinicId" = clinic_uuid_2
      WHERE role = 'clinic' 
        AND "clinicId" IS NULL
        AND email = 'clinic2@test.ayurlahi.com';
    ELSE
      -- Only one clinic, check if we can assign both
      -- If there's a unique constraint preventing this, we need to remove it or work around it
      RAISE NOTICE 'Only one clinic available. Attempting to assign both users...';
      
      -- Try to update both (might fail if unique constraint exists)
      BEGIN
        UPDATE users 
        SET "clinicId" = clinic_uuid
        WHERE role = 'clinic' 
          AND "clinicId" IS NULL
          AND email LIKE '%@test.ayurlahi.com';
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE 'Updated % clinic user(s)', updated_count;
      EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'Unique constraint violation. Only one user can be assigned to this clinic.';
        RAISE NOTICE 'Assigning only the first clinic user...';
        
        -- Assign only the first one
        UPDATE users 
        SET "clinicId" = clinic_uuid
        WHERE role = 'clinic' 
          AND "clinicId" IS NULL
          AND email = 'clinic@test.ayurlahi.com'
        LIMIT 1;
      END;
    END IF;
  ELSE
    -- No existing user with this clinicId, safe to assign
    UPDATE users 
    SET "clinicId" = clinic_uuid
    WHERE role = 'clinic' 
      AND "clinicId" IS NULL
      AND email LIKE '%@test.ayurlahi.com';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % clinic user(s)', updated_count;
  END IF;
END $$;

-- Verify the update
SELECT 
  'After Update:' as info,
  email, 
  "firstName", 
  "lastName", 
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

