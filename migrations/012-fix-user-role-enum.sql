-- Migration: Fix user role column to use enum type
-- The entity expects varchar, but the database has USER-DEFINED (enum)
-- This migration ensures the enum type exists and is properly configured

BEGIN;

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

