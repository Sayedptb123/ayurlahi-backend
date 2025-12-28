-- Create Base Tables (Users and Clinics)

BEGIN;

-- Create extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL UNIQUE,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "role" VARCHAR(20) DEFAULT 'clinic' NOT NULL,
    "phone" VARCHAR(20),
    "landphone" VARCHAR(20),
    "mobile_numbers" TEXT[],
    "whatsapp_number" VARCHAR(20),
    "is_active" BOOLEAN DEFAULT true NOT NULL,
    "is_email_verified" BOOLEAN DEFAULT false NOT NULL,
    "clinic_id" UUID,
    "manufacturer_id" UUID,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "last_login_at" TIMESTAMP
);

-- Indexes for users
CREATE INDEX IF NOT EXISTS "IDX_users_email" ON "users"("email");
CREATE INDEX IF NOT EXISTS "IDX_users_role" ON "users"("role");

-- ============================================================================
-- CLINICS TABLE
-- ============================================================================

-- Create ApprovalStatus Enum
DO $$ BEGIN
    CREATE TYPE approval_status_enum AS ENUM ('pending', 'approved', 'rejected', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "clinics" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL UNIQUE,
    "clinicName" VARCHAR(255) NOT NULL,
    "gstin" VARCHAR(50) UNIQUE,
    "licenseNumber" VARCHAR(100) NOT NULL UNIQUE,
    "address" TEXT NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "district" VARCHAR(100),
    "state" VARCHAR(100) NOT NULL,
    "pincode" VARCHAR(10) NOT NULL,
    "country" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(20),
    "whatsappNumber" VARCHAR(20),
    "approvalStatus" approval_status_enum DEFAULT 'pending' NOT NULL,
    "rejectionReason" TEXT,
    "documents" JSONB,
    "isVerified" BOOLEAN DEFAULT false NOT NULL,
    "approvedAt" TIMESTAMP,
    "approvedBy" UUID,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" TIMESTAMP
);

-- Foreign Key: clinics.userId -> users.id
ALTER TABLE "clinics" 
    ADD CONSTRAINT "FK_clinics_user" 
    FOREIGN KEY ("userId") 
    REFERENCES "users"("id") 
    ON DELETE CASCADE;

-- Foreign Key: users.clinic_id -> clinics.id (Circular reference, handle carefully)
ALTER TABLE "users"
    ADD CONSTRAINT "FK_users_clinic"
    FOREIGN KEY ("clinic_id")
    REFERENCES "clinics"("id")
    ON DELETE SET NULL;

COMMIT;
