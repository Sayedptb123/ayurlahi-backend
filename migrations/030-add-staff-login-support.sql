-- Migration: Add Staff Login Support (Correct Approach)
-- Description: Extends organisation roles and links staff to user accounts
-- Date: 2026-01-16
-- Architecture: Multi-tenant organization-based system

-- ============================================================================
-- STEP 1: Add Missing Staff Roles to UserRole Enum
-- ============================================================================

-- Note: We're adding UPPERCASE roles to match existing pattern (DOCTOR, MANAGER, STAFF)
-- These roles will be used in organisation_users.role, NOT users.role

DO $$ 
BEGIN
    -- Add NURSE role
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'user_role' AND e.enumlabel = 'NURSE'
    ) THEN
        ALTER TYPE user_role ADD VALUE 'NURSE';
        RAISE NOTICE 'Added NURSE role';
    END IF;
    
    -- Add THERAPIST role
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'user_role' AND e.enumlabel = 'THERAPIST'
    ) THEN
        ALTER TYPE user_role ADD VALUE 'THERAPIST';
        RAISE NOTICE 'Added THERAPIST role';
    END IF;
    
    -- Add PHARMACIST role
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'user_role' AND e.enumlabel = 'PHARMACIST'
    ) THEN
        ALTER TYPE user_role ADD VALUE 'PHARMACIST';
        RAISE NOTICE 'Added PHARMACIST role';
    END IF;
    
    -- Add RECEPTIONIST role
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'user_role' AND e.enumlabel = 'RECEPTIONIST'
    ) THEN
        ALTER TYPE user_role ADD VALUE 'RECEPTIONIST';
        RAISE NOTICE 'Added RECEPTIONIST role';
    END IF;
    
    -- Add LAB_TECHNICIAN role
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'user_role' AND e.enumlabel = 'LAB_TECHNICIAN'
    ) THEN
        ALTER TYPE user_role ADD VALUE 'LAB_TECHNICIAN';
        RAISE NOTICE 'Added LAB_TECHNICIAN role';
    END IF;
    
    -- Add PATIENT role (for future patient portal)
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'user_role' AND e.enumlabel = 'PATIENT'
    ) THEN
        ALTER TYPE user_role ADD VALUE 'PATIENT';
        RAISE NOTICE 'Added PATIENT role';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Add User Account Fields to Staff Table
-- ============================================================================

-- Add columns to link staff to user accounts
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS has_user_account BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS user_account_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS invitation_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP;

-- ============================================================================
-- STEP 3: Create Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_invitation_token ON staff(invitation_token);
CREATE INDEX IF NOT EXISTS idx_staff_has_user_account ON staff(has_user_account);
CREATE INDEX IF NOT EXISTS idx_staff_user_account_status ON staff(user_account_status);

-- ============================================================================
-- STEP 4: Add Constraints
-- ============================================================================

-- Ensure invitation token is unique when not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_invitation_token_unique 
ON staff(invitation_token) 
WHERE invitation_token IS NOT NULL;

-- ============================================================================
-- STEP 5: Add Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN staff.user_id IS 'Links staff record to user account in users table for login access';
COMMENT ON COLUMN staff.has_user_account IS 'Whether this staff member has login credentials (user account created)';
COMMENT ON COLUMN staff.user_account_status IS 'Status of user account: pending (invited but not accepted), active (can login), suspended (login disabled)';
COMMENT ON COLUMN staff.invitation_token IS 'Secure token for staff invitation link (valid for 24 hours)';
COMMENT ON COLUMN staff.invitation_sent_at IS 'Timestamp when invitation was sent to staff member';
COMMENT ON COLUMN staff.invitation_expires_at IS 'Expiration time for invitation token (typically 24 hours from sent_at)';

-- ============================================================================
-- STEP 6: Verification and Summary
-- ============================================================================

DO $$
DECLARE
    role_count INTEGER;
    staff_columns_count INTEGER;
BEGIN
    -- Count new roles added
    SELECT COUNT(*) INTO role_count
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'user_role' 
    AND e.enumlabel IN ('NURSE', 'THERAPIST', 'PHARMACIST', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'PATIENT');
    
    -- Count new columns in staff table
    SELECT COUNT(*) INTO staff_columns_count
    FROM information_schema.columns
    WHERE table_name = 'staff'
    AND column_name IN ('user_id', 'has_user_account', 'user_account_status', 'invitation_sent_at', 'invitation_token', 'invitation_expires_at');
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'New user roles added: % (NURSE, THERAPIST, PHARMACIST, RECEPTIONIST, LAB_TECHNICIAN, PATIENT)', role_count;
    RAISE NOTICE 'Staff table columns added: %', staff_columns_count;
    RAISE NOTICE 'Indexes created: 4 (user_id, invitation_token, has_user_account, user_account_status)';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Update UserRole enum in backend code';
    RAISE NOTICE '2. Update Staff entity to include new fields';
    RAISE NOTICE '3. Implement staff invitation service';
    RAISE NOTICE '4. Update frontend to show "Create Login" button';
    RAISE NOTICE '========================================';
END $$;
