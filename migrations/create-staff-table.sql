-- Migration: Create staff table
-- This migration creates the staff table for managing staff members in clinics and manufacturers
-- If the table already exists with wrong structure, drop it first: DROP TABLE IF EXISTS staff CASCADE;

-- Drop existing table if it has wrong structure (WARNING: Deletes all data!)
-- Uncomment the next line if you need to recreate the table
-- DROP TABLE IF EXISTS staff CASCADE;

CREATE TABLE IF NOT EXISTS staff (
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

-- Drop existing indexes if they exist (will be recreated below)
DROP INDEX IF EXISTS idx_staff_organization_id;
DROP INDEX IF EXISTS idx_staff_organization_type;
DROP INDEX IF EXISTS idx_staff_position;
DROP INDEX IF EXISTS idx_staff_is_active;
DROP INDEX IF EXISTS idx_staff_organization_active;

-- Create indexes for better query performance
CREATE INDEX idx_staff_organization_id ON staff(organization_id);
CREATE INDEX idx_staff_organization_type ON staff(organization_type);
CREATE INDEX idx_staff_position ON staff(position);
CREATE INDEX idx_staff_is_active ON staff(is_active);
CREATE INDEX idx_staff_organization_active ON staff(organization_id, is_active);

-- Add foreign key constraints (adjust table names based on your schema)
-- For clinics
-- ALTER TABLE staff ADD CONSTRAINT fk_staff_clinic 
--   FOREIGN KEY (organization_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- For manufacturers
-- ALTER TABLE staff ADD CONSTRAINT fk_staff_manufacturer 
--   FOREIGN KEY (organization_id) REFERENCES manufacturers(id) ON DELETE CASCADE;

-- Note: Since staff can belong to either clinics or manufacturers,
-- you may need to implement a check constraint or use a polymorphic relationship.
-- For now, the foreign key constraints are commented out.
-- You can uncomment and modify based on your database structure.

COMMENT ON TABLE staff IS 'Staff members associated with clinics or manufacturers';
COMMENT ON COLUMN staff.organization_id IS 'ID of the clinic or manufacturer';
COMMENT ON COLUMN staff.organization_type IS 'Type of organization: clinic or manufacturer';
COMMENT ON COLUMN staff.position IS 'Staff position (doctor, therapist, production_manager, etc.)';
COMMENT ON COLUMN staff.position_custom IS 'Custom position name when position is "other"';
COMMENT ON COLUMN staff.qualifications IS 'JSON array of qualification strings';

