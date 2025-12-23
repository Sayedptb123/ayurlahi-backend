-- Combined Migration: Fix All Schema Mismatches
-- This migration fixes:
-- 1. Users table column names (camelCase → snake_case)
-- 2. Patient gender enum type
-- 3. User role enum type
-- Date: 2025-12-24

BEGIN;

-- ============================================
-- PART 1: Fix Users Table Column Names
-- ============================================
-- Rename columns from camelCase to snake_case to match the User entity

ALTER TABLE users RENAME COLUMN "password" TO "password_hash";
ALTER TABLE users RENAME COLUMN "firstName" TO "first_name";
ALTER TABLE users RENAME COLUMN "lastName" TO "last_name";
ALTER TABLE users RENAME COLUMN "isActive" TO "is_active";
ALTER TABLE users RENAME COLUMN "isEmailVerified" TO "is_email_verified";
ALTER TABLE users RENAME COLUMN "whatsappNumber" TO "whatsapp_number";
ALTER TABLE users RENAME COLUMN "lastLoginAt" TO "last_login_at";
ALTER TABLE users RENAME COLUMN "clinicId" TO "clinic_id";
ALTER TABLE users RENAME COLUMN "manufacturerId" TO "manufacturer_id";
ALTER TABLE users RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE users RENAME COLUMN "updatedAt" TO "updated_at";

-- Note: deletedAt and address columns exist in DB but not in entity
-- Keeping them for now (soft delete support and potential future use)
-- Uncomment below if you want to remove them:
-- ALTER TABLE users DROP COLUMN IF EXISTS "deletedAt";
-- ALTER TABLE users DROP COLUMN IF EXISTS "address";

-- ============================================
-- PART 2: Fix Patient Gender Enum
-- ============================================
-- Create the gender enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Convert the gender column to use the enum type
-- First, ensure all existing values are valid enum values
UPDATE patients 
SET gender = 'other' 
WHERE gender IS NOT NULL 
  AND gender NOT IN ('male', 'female', 'other');

-- Now alter the column type
ALTER TABLE patients 
  ALTER COLUMN gender TYPE gender_enum 
  USING gender::gender_enum;

-- ============================================
-- PART 3: Fix User Role Enum
-- ============================================
-- Create the user_role enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('clinic', 'manufacturer', 'admin', 'support');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- If the role column is already an enum, this will do nothing
-- If it's varchar, convert it to enum
DO $$ 
BEGIN
    -- Check if column is already enum type
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'role' 
        AND data_type = 'USER-DEFINED'
    ) THEN
        -- Already an enum, nothing to do
        RAISE NOTICE 'Role column is already an enum type';
    ELSE
        -- Convert varchar to enum
        ALTER TABLE users 
          ALTER COLUMN role TYPE user_role_enum 
          USING role::user_role_enum;
    END IF;
END $$;

COMMIT;

-- Verification queries (run these after migration to verify):
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'gender';

