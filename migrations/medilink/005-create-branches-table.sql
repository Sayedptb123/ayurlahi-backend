-- ============================================
-- Phase 2: Branch Management - Branches Table
-- MediLink - A product from Team Ayurlahi
-- ============================================

CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  
  -- Branch details
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50), -- Optional branch code (e.g., "BR001", "MAIN")
  
  -- Contact information
  phone VARCHAR(20),
  email VARCHAR(255),
  whatsapp_number VARCHAR(20),
  
  -- Address
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  country VARCHAR(50) DEFAULT 'India',
  
  -- Branch manager
  manager_id UUID REFERENCES users(id), -- Branch manager (optional)
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false, -- Primary/main branch
  
  -- Operating hours (JSONB for flexibility)
  operating_hours JSONB, -- { "monday": {"open": "09:00", "close": "18:00"}, ... }
  
  -- Additional info
  description TEXT,
  notes TEXT,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_branches_org ON branches(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_branches_active ON branches(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_branches_primary ON branches(organisation_id, is_primary) WHERE is_primary = true AND deleted_at IS NULL;

-- Partial unique index for branch code (only when code is not null)
CREATE UNIQUE INDEX idx_branches_code_unique ON branches(organisation_id, code) WHERE code IS NOT NULL;

-- Comments
COMMENT ON TABLE branches IS 'Branches table - sub-locations of organisations';
COMMENT ON COLUMN branches.organisation_id IS 'Parent organisation';
COMMENT ON COLUMN branches.is_primary IS 'True if this is the primary/main branch';
COMMENT ON COLUMN branches.manager_id IS 'Branch manager (user with access to this branch)';

