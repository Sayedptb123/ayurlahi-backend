-- ============================================
-- Phase 3: Duty Assignment - Duty Assignments Table
-- MediLink - A product from Team Ayurlahi
-- ============================================

CREATE TABLE duty_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  duty_type_id UUID NOT NULL REFERENCES duty_types(id) ON DELETE RESTRICT,
  
  -- Assignment date
  duty_date DATE NOT NULL,
  
  -- Actual times (can differ from duty_type times)
  start_time TIME,
  end_time TIME,
  
  -- Check-in/Check-out
  checked_in_at TIMESTAMP,
  checked_out_at TIMESTAMP,
  check_in_location JSONB, -- { "lat": 12.9716, "lng": 77.5946, "address": "..." }
  check_out_location JSONB,
  
  -- Status
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN (
    'scheduled',    -- Assigned but not started
    'in_progress', -- Checked in
    'completed',   -- Checked out
    'absent',      -- Did not show up
    'cancelled'    -- Cancelled
  )),
  
  -- Notes
  notes TEXT,
  
  -- Replacement (if staff was replaced)
  replaced_by_staff_id UUID REFERENCES staff(id),
  replacement_reason TEXT,
  
  -- Metadata
  assigned_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_duty_assignments_org ON duty_assignments(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_duty_assignments_branch ON duty_assignments(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_duty_assignments_staff ON duty_assignments(staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_duty_assignments_duty_type ON duty_assignments(duty_type_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_duty_assignments_date ON duty_assignments(duty_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_duty_assignments_status ON duty_assignments(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_duty_assignments_staff_date ON duty_assignments(staff_id, duty_date) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE duty_assignments IS 'Duty assignments table - links staff to duties on specific dates';
COMMENT ON COLUMN duty_assignments.duty_date IS 'Date of the duty assignment';
COMMENT ON COLUMN duty_assignments.status IS 'Current status of the duty assignment';





