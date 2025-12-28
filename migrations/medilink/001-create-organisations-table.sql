-- ============================================
-- Phase 1: Foundation - Organisations Table
-- MediLink - A product from Team Ayurlahi
-- ============================================

CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('AYURLAHI_TEAM', 'CLINIC', 'MANUFACTURER')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  
  -- Clinic-specific fields (nullable)
  clinic_name VARCHAR(255),
  license_number VARCHAR(100) UNIQUE,
  gstin VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  country VARCHAR(50) DEFAULT 'India',
  phone VARCHAR(20),
  whatsapp_number VARCHAR(20),
  social_media JSONB,
  approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  documents JSONB,
  is_verified BOOLEAN DEFAULT false,
  approved_at TIMESTAMP,
  approved_by UUID,
  
  -- Manufacturer-specific fields (nullable)
  company_name VARCHAR(255),
  commission_rate DECIMAL(5,2) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_organisations_type ON organisations(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_organisations_status ON organisations(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_organisations_approval_status ON organisations(approval_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_organisations_deleted ON organisations(deleted_at) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE organisations IS 'Organisations table - supports AYURLAHI_TEAM, CLINIC, and MANUFACTURER types';
COMMENT ON COLUMN organisations.type IS 'Type of organisation: AYURLAHI_TEAM, CLINIC, or MANUFACTURER';
COMMENT ON COLUMN organisations.status IS 'Organisation status: active, suspended, or inactive';
COMMENT ON COLUMN organisations.approval_status IS 'Approval status for clinics/manufacturers: pending, approved, or rejected';




