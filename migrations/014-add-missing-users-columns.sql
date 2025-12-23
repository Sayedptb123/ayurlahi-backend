-- Migration: Add Missing Users Table Columns
-- Description: Adds landphone and mobile_numbers columns if they don't exist
-- Date: 2025-12-24

BEGIN;

-- Add landphone column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'landphone'
    ) THEN
        ALTER TABLE users ADD COLUMN landphone VARCHAR NULL;
        RAISE NOTICE 'Added landphone column';
    ELSE
        RAISE NOTICE 'landphone column already exists';
    END IF;
END $$;

-- Add mobile_numbers column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'mobile_numbers'
    ) THEN
        ALTER TABLE users ADD COLUMN mobile_numbers TEXT[] NULL;
        RAISE NOTICE 'Added mobile_numbers column';
    ELSE
        RAISE NOTICE 'mobile_numbers column already exists';
    END IF;
END $$;

-- Verify the columns were added
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND column_name IN ('landphone', 'mobile_numbers')
ORDER BY column_name;

COMMIT;

-- Migration complete!
-- The users table now has the landphone and mobile_numbers columns.

