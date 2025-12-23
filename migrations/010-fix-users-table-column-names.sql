-- Migration: Fix users table column names to match entity definitions
-- This migration renames camelCase columns to snake_case to match the User entity

BEGIN;

-- Rename columns from camelCase to snake_case
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

-- Note: deletedAt column exists in DB but not in entity - keeping it for now (soft delete support)
-- If you want to remove it, uncomment the following:
-- ALTER TABLE users DROP COLUMN IF EXISTS "deletedAt";

-- Note: address column exists in DB but not in entity - keeping it for now
-- If you want to remove it, uncomment the following:
-- ALTER TABLE users DROP COLUMN IF EXISTS "address";

COMMIT;

