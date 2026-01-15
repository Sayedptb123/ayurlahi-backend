-- Migration: Add Staff Login Support (Corrected for VARCHAR roles)
-- Description: Extends organisation roles and links staff to user accounts
-- Date: 2026-01-16
-- Architecture: Multi-tenant organization-based system with VARCHAR roles

-- ============================================================================
-- STEP 1: Drop Existing Role Check Constraint
-- ============================================================================

ALTER TABLE organisation_users 
DROP CONSTRAINT IF EXISTS organisation_users_role_check;

-- ============================================================================
-- STEP 2: Add New Role Check Constraint with All Roles
-- ============================================================================

ALTER TABLE organisation_users
ADD CONSTRAINT organisation_users_role_check CHECK (
    role IN (
        -- Existing roles
        'SUPER_ADMIN',
        'SUPPORT',
        'OWNER',
        'MANAGER',
        'STAFF',
        'DOCTOR',
        'ADMIN',
        
        -- New staff roles
        'NURSE',
        'THERAPIST',
        'PHARMACIST',
        'RECEPTIONIST',
        'LAB_TECHNICIAN',
        
        -- Future roles
        'PATIENT'
    )
);

-- ============================================================================
-- STEP 3: Staff Table Already Has user_id (from previous migration)
-- ============================================================================

-- Verify staff table has the necessary columns
DO $$
DECLARE
    has_user_id BOOLEAN;
    has_user_account BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff' AND column_name = 'user_id'
    ) INTO has_user_id;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff' AND column_name = 'has_user_account'
    ) INTO has_user_account;
    
    IF has_user_id THEN
        RAISE NOTICE '✓ staff.user_id column exists';
    ELSE
        RAISE EXCEPTION 'staff.user_id column missing! Run previous migration first.';
    END IF;
    
    IF has_user_account THEN
        RAISE NOTICE '✓ staff.has_user_account column exists';
    ELSE
        RAISE NOTICE '⚠ staff.has_user_account column missing, adding it now...';
        ALTER TABLE staff ADD COLUMN has_user_account BOOLEAN DEFAULT false;
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Add Missing Columns if Needed
-- ============================================================================

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS user_account_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS invitation_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP;

-- ============================================================================
-- STEP 5: Create Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_invitation_token ON staff(invitation_token);
CREATE INDEX IF NOT EXISTS idx_staff_has_user_account ON staff(has_user_account);
CREATE INDEX IF NOT EXISTS idx_staff_user_account_status ON staff(user_account_status);

-- ============================================================================
-- STEP 6: Add Unique Constraint on Invitation Token
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_invitation_token_unique 
ON staff(invitation_token) 
WHERE invitation_token IS NOT NULL;

-- ============================================================================
-- STEP 7: Add Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN staff.user_id IS 'Links staff record to user account in users table for login access';
COMMENT ON COLUMN staff.has_user_account IS 'Whether this staff member has login credentials (user account created)';
COMMENT ON COLUMN staff.user_account_status IS 'Status of user account: pending (invited but not accepted), active (can login), suspended (login disabled)';
COMMENT ON COLUMN staff.invitation_token IS 'Secure token for staff invitation link (valid for 24 hours)';
COMMENT ON COLUMN staff.invitation_sent_at IS 'Timestamp when invitation was sent to staff member';
COMMENT ON COLUMN staff.invitation_expires_at IS 'Expiration time for invitation token (typically 24 hours from sent_at)';

-- ============================================================================
-- STEP 8: Verification and Summary
-- ============================================================================

DO $$
DECLARE
    staff_columns_count INTEGER;
    role_constraint_def TEXT;
BEGIN
    -- Count columns in staff table
    SELECT COUNT(*) INTO staff_columns_count
    FROM information_schema.columns
    WHERE table_name = 'staff'
    AND column_name IN ('user_id', 'has_user_account', 'user_account_status', 'invitation_sent_at', 'invitation_token', 'invitation_expires_at');
    
    -- Get role constraint definition
    SELECT pg_get_constraintdef(oid) INTO role_constraint_def
    FROM pg_constraint
    WHERE conname = 'organisation_users_role_check';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Organisation roles updated: NURSE, THERAPIST, PHARMACIST, RECEPTIONIST, LAB_TECHNICIAN, PATIENT added';
    RAISE NOTICE 'Staff table columns verified: % columns present', staff_columns_count;
    RAISE NOTICE 'Indexes created: 4 (user_id, invitation_token, has_user_account, user_account_status)';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Role constraint: %', role_constraint_def;
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Update UserRole enum in backend code (src/users/enums/user-role.enum.ts)';
    RAISE NOTICE '2. Update Staff entity to include new fields (src/staff/entities/staff.entity.ts)';
    RAISE NOTICE '3. Implement staff invitation service';
    RAISE NOTICE '4. Update frontend to show "Create Login" button';
    RAISE NOTICE '========================================';
END $$;
