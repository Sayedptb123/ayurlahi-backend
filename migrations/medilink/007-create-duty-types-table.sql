-- ============================================
-- Phase 3: Duty Assignment - Duty Types Table
-- MediLink - A product from Team Ayurlahi
-- ============================================

CREATE TABLE duty_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  
  -- Duty type details
  name VARCHAR(255) NOT NULL, -- "Morning Shift", "Evening Shift", "Night Shift", "On-Call"
  code VARCHAR(50), -- Optional code (e.g., "MORN", "EVE", "NIGHT")
  description TEXT,
  
  -- Time details
  start_time TIME NOT NULL, -- e.g., "09:00:00"
  end_time TIME NOT NULL, -- e.g., "18:00:00"
  duration_hours DECIMAL(4,2), -- Calculated duration
  
  -- Color for calendar display
  color VARCHAR(7), -- Hex color code (e.g., "#FF5733")
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_duty_types_org ON duty_types(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_duty_types_active ON duty_types(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_duty_types_deleted ON duty_types(deleted_at) WHERE deleted_at IS NULL;

-- Partial unique index for duty type name (only when not deleted)
CREATE UNIQUE INDEX idx_duty_types_name_unique ON duty_types(organisation_id, name) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE duty_types IS 'Duty types table - defines different types of duties/shifts';
COMMENT ON COLUMN duty_types.start_time IS 'Start time of the duty/shift';
COMMENT ON COLUMN duty_types.end_time IS 'End time of the duty/shift';

