-- Migration: Fix patient gender column to use enum type
-- The entity expects an enum, but the database has character varying

BEGIN;

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

COMMIT;

