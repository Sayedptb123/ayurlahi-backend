-- ============================================
-- Phase 1: Foundation - OrganisationUsers Table (Junction)
-- MediLink - A product from Team Ayurlahi
-- ============================================

CREATE TABLE organisation_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN (
    'SUPER_ADMIN',      -- Team Ayurlahi
    'SUPPORT',          -- Team Ayurlahi
    'OWNER',            -- Clinic/Manufacturer
    'MANAGER',          -- Clinic/Manufacturer
    'STAFF'             -- Clinic/Manufacturer
  )),
  permissions JSONB, -- Granular permissions
  is_primary BOOLEAN DEFAULT false, -- Primary user for this org
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure user can't have duplicate roles in same org
  CONSTRAINT unique_user_org_role UNIQUE(user_id, organisation_id, role)
);

-- Indexes
CREATE INDEX idx_org_users_user_id ON organisation_users(user_id);
CREATE INDEX idx_org_users_org_id ON organisation_users(organisation_id);
CREATE INDEX idx_org_users_role ON organisation_users(role);
CREATE INDEX idx_org_users_primary ON organisation_users(organisation_id, is_primary) WHERE is_primary = true;

-- Partial unique index to ensure one primary user per organisation
CREATE UNIQUE INDEX idx_org_users_unique_primary 
  ON organisation_users(organisation_id) 
  WHERE is_primary = true;

-- Comments
COMMENT ON TABLE organisation_users IS 'Junction table linking users to organisations with roles';
COMMENT ON COLUMN organisation_users.role IS 'Access role: SUPER_ADMIN, SUPPORT, OWNER, MANAGER, or STAFF';
COMMENT ON COLUMN organisation_users.permissions IS 'JSONB field for granular permissions';
COMMENT ON COLUMN organisation_users.is_primary IS 'True if this is the primary user for the organisation';

