-- Script to fix users table schema
-- Run this in your PostgreSQL database

-- Check current columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users';

-- Add password column if it doesn't exist (as nullable initially)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password'
    ) THEN
        ALTER TABLE users ADD COLUMN password VARCHAR;
    END IF;
END $$;

-- If password_hash exists, you can migrate data:
-- UPDATE users SET password = password_hash WHERE password_hash IS NOT NULL;
-- Then drop password_hash:
-- ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

-- Make password NOT NULL after updating existing rows (if needed)
-- ALTER TABLE users ALTER COLUMN password SET NOT NULL;








