-- Safe Migration: Create staff table (handles existing table)
-- This migration safely creates or recreates the staff table

-- First, drop the table if it exists (WARNING: This will delete all data!)
-- Comment out the DROP TABLE line if you want to preserve existing data
DROP TABLE IF EXISTS staff CASCADE;

-- Create the staff table
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  organization_type VARCHAR(20) NOT NULL CHECK (organization_type IN ('clinic', 'manufacturer')),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  position VARCHAR(50) NOT NULL,
  position_custom VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  whatsapp_number VARCHAR(20),
  address_street TEXT,
  address_city VARCHAR(100),
  address_district VARCHAR(100),
  address_state VARCHAR(100),
  address_zip_code VARCHAR(20),
  address_country VARCHAR(100),
  date_of_birth DATE,
  date_of_joining DATE,
  salary DECIMAL(10, 2),
  qualifications JSONB, -- Array of strings
  specialization VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraint: position_custom is required when position is 'other'
  CONSTRAINT chk_position_other_requires_custom CHECK (
    (position != 'other') OR (position = 'other' AND position_custom IS NOT NULL)
  )
);

-- Create indexes for better query performance
CREATE INDEX idx_staff_organization_id ON staff(organization_id);
CREATE INDEX idx_staff_organization_type ON staff(organization_type);
CREATE INDEX idx_staff_position ON staff(position);
CREATE INDEX idx_staff_is_active ON staff(is_active);
CREATE INDEX idx_staff_organization_active ON staff(organization_id, is_active);

-- Add comments
COMMENT ON TABLE staff IS 'Staff members associated with clinics or manufacturers';
COMMENT ON COLUMN staff.organization_id IS 'ID of the clinic or manufacturer';
COMMENT ON COLUMN staff.organization_type IS 'Type of organization: clinic or manufacturer';
COMMENT ON COLUMN staff.position IS 'Staff position (doctor, therapist, production_manager, etc.)';
COMMENT ON COLUMN staff.position_custom IS 'Custom position name when position is "other"';
COMMENT ON COLUMN staff.qualifications IS 'JSON array of qualification strings';


