-- Migration: Fix Users Table Schema to Match Entity
-- Description: Renames columns to snake_case to match TypeORM entity definitions
-- Date: 2025-12-24
-- 
-- This migration ensures the database schema matches the User entity:
-- - password -> password_hash
-- - firstName -> first_name (if exists)
-- - lastName -> last_name (if exists)
-- - isActive -> is_active (if exists)
-- - isEmailVerified -> is_email_verified (if exists)
-- - createdAt -> created_at (if exists)
-- - updatedAt -> updated_at (if exists)
-- - clinicId -> clinic_id (if exists)
-- - manufacturerId -> manufacturer_id (if exists)
-- - lastLoginAt -> last_login_at (if exists)
-- - whatsappNumber -> whatsapp_number (if exists)
-- - mobileNumbers -> mobile_numbers (if exists)

BEGIN;

-- Check and rename password column
DO $$ 
BEGIN
    -- If 'password' exists but 'password_hash' doesn't, rename it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE users RENAME COLUMN password TO password_hash;
        RAISE NOTICE 'Renamed password to password_hash';
    END IF;
END $$;

-- Check and rename firstName column
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'firstName'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'first_name'
    ) THEN
        ALTER TABLE users RENAME COLUMN "firstName" TO first_name;
        RAISE NOTICE 'Renamed firstName to first_name';
    END IF;
END $$;

-- Check and rename lastName column
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'lastName'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_name'
    ) THEN
        ALTER TABLE users RENAME COLUMN "lastName" TO last_name;
        RAISE NOTICE 'Renamed lastName to last_name';
    END IF;
END $$;

-- Check and rename isActive column
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'isActive'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE users RENAME COLUMN "isActive" TO is_active;
        RAISE NOTICE 'Renamed isActive to is_active';
    END IF;
END $$;

-- Check and rename isEmailVerified column
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'isEmailVerified'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_email_verified'
    ) THEN
        ALTER TABLE users RENAME COLUMN "isEmailVerified" TO is_email_verified;
        RAISE NOTICE 'Renamed isEmailVerified to is_email_verified';
    END IF;
END $$;

-- Check and rename createdAt column
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'createdAt'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE users RENAME COLUMN "createdAt" TO created_at;
        RAISE NOTICE 'Renamed createdAt to created_at';
    END IF;
END $$;

-- Check and rename updatedAt column
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'updatedAt'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE users RENAME COLUMN "updatedAt" TO updated_at;
        RAISE NOTICE 'Renamed updatedAt to updated_at';
    END IF;
END $$;

-- Check and rename clinicId column
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'clinicId'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'clinic_id'
    ) THEN
        ALTER TABLE users RENAME COLUMN "clinicId" TO clinic_id;
        RAISE NOTICE 'Renamed clinicId to clinic_id';
    END IF;
END $$;

-- Check and rename manufacturerId column
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'manufacturerId'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'manufacturer_id'
    ) THEN
        ALTER TABLE users RENAME COLUMN "manufacturerId" TO manufacturer_id;
        RAISE NOTICE 'Renamed manufacturerId to manufacturer_id';
    END IF;
END $$;

-- Check and rename lastLoginAt column
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'lastLoginAt'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_login_at'
    ) THEN
        ALTER TABLE users RENAME COLUMN "lastLoginAt" TO last_login_at;
        RAISE NOTICE 'Renamed lastLoginAt to last_login_at';
    END IF;
END $$;

-- Check and rename whatsappNumber column
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'whatsappNumber'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'whatsapp_number'
    ) THEN
        ALTER TABLE users RENAME COLUMN "whatsappNumber" TO whatsapp_number;
        RAISE NOTICE 'Renamed whatsappNumber to whatsapp_number';
    END IF;
END $$;

-- Check and rename mobileNumbers column
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'mobileNumbers'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'mobile_numbers'
    ) THEN
        ALTER TABLE users RENAME COLUMN "mobileNumbers" TO mobile_numbers;
        RAISE NOTICE 'Renamed mobileNumbers to mobile_numbers';
    END IF;
END $$;

-- Verify final schema
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

COMMIT;

-- Migration complete!
-- The users table now matches the User entity schema.

