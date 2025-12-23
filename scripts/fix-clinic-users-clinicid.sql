-- Fix Clinic Users - Assign Clinic ID
-- Run this to update existing clinic users with a clinicId
-- Usage: psql -U your_username -d ayurlahi -f scripts/fix-clinic-users-clinicid.sql

-- Get the first clinic ID
DO $$
DECLARE
  clinic_uuid UUID;
  updated_count INTEGER;
BEGIN
  -- Get first clinic
  SELECT id INTO clinic_uuid FROM clinics LIMIT 1;
  
  IF clinic_uuid IS NULL THEN
    RAISE NOTICE 'No clinic found. Please create a clinic first.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found clinic ID: %', clinic_uuid;
  
  -- Update clinic users that don't have a clinicId
  UPDATE users 
  SET "clinicId" = clinic_uuid
  WHERE role = 'clinic' 
    AND "clinicId" IS NULL
    AND email LIKE '%@test.ayurlahi.com';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RAISE NOTICE 'Updated % clinic user(s)', updated_count;
END $$;

-- Verify the update
SELECT 
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

