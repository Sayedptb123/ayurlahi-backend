-- ============================================
-- Phase 2: Branch Management - Staff Branch Assignments
-- MediLink - A product from Team Ayurlahi
-- Note: Requires staff table (010-create-staff-table.sql)
-- ============================================

CREATE TABLE staff_branch_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  
  -- Assignment period
  assigned_from DATE NOT NULL DEFAULT CURRENT_DATE,
  assigned_to DATE, -- NULL for current assignment
  
  -- Assignment type (permanent, temporary, or rotating)
  assignment_type VARCHAR(20) DEFAULT 'permanent' CHECK (assignment_type IN ('permanent', 'temporary', 'rotating')),
  
  -- Role at branch (if different from main role)
  branch_role VARCHAR(50), -- Optional: role specific to this branch
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false, -- Primary branch for this staff
  
  -- Additional info
  notes TEXT,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_staff_branch_org ON staff_branch_assignments(organisation_id);
CREATE INDEX idx_staff_branch_branch ON staff_branch_assignments(branch_id);
CREATE INDEX idx_staff_branch_staff ON staff_branch_assignments(staff_id);
CREATE INDEX idx_staff_branch_active ON staff_branch_assignments(staff_id, is_active) WHERE is_active = true;
CREATE INDEX idx_staff_branch_primary ON staff_branch_assignments(staff_id, is_primary) WHERE is_primary = true;

-- Partial unique index to ensure staff can't be assigned to same branch twice (active)
CREATE UNIQUE INDEX idx_staff_branch_unique_active 
  ON staff_branch_assignments(staff_id, branch_id) 
  WHERE is_active = true;

-- Comments
COMMENT ON TABLE staff_branch_assignments IS 'Junction table linking staff to branches';
COMMENT ON COLUMN staff_branch_assignments.assignment_type IS 'Type of assignment: permanent, temporary, or rotating';
COMMENT ON COLUMN staff_branch_assignments.is_primary IS 'True if this is the staff member''s primary branch';

