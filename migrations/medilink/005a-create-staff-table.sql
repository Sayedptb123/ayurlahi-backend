-- ============================================
-- Phase 2: Staff Table (Required for Branch Assignments)
-- MediLink - A product from Team Ayurlahi
-- ============================================

CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  
  -- Staff details
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  position VARCHAR(50) NOT NULL,
  position_custom VARCHAR(100),
  
  -- Contact
  email VARCHAR(255),
  phone VARCHAR(20),
  whatsapp_number VARCHAR(20),
  
  -- Address
  address_street TEXT,
  address_city VARCHAR(100),
  address_district VARCHAR(100),
  address_state VARCHAR(100),
  address_zip_code VARCHAR(20),
  address_country VARCHAR(100),
  
  -- Personal info
  date_of_birth DATE,
  date_of_joining DATE,
  
  -- Employment
  salary DECIMAL(10, 2),
  qualifications JSONB, -- Array of strings
  specialization VARCHAR(255),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraint: position_custom is required when position is 'other'
  CONSTRAINT chk_position_other_requires_custom CHECK (
    (position != 'other') OR (position = 'other' AND position_custom IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_staff_organisation_id ON staff(organisation_id);
CREATE INDEX idx_staff_position ON staff(position);
CREATE INDEX idx_staff_is_active ON staff(is_active);
CREATE INDEX idx_staff_organisation_active ON staff(organisation_id, is_active);

-- Comments
COMMENT ON TABLE staff IS 'Staff members associated with organisations';
COMMENT ON COLUMN staff.organisation_id IS 'ID of the organisation (clinic/manufacturer)';

