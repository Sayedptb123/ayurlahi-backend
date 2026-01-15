-- ============================================
-- Phase 1: Foundation - Create AYURLAHI_TEAM Organisation
-- MediLink - A product from Team Ayurlahi
-- ============================================

-- Insert the AYURLAHI_TEAM organisation
INSERT INTO organisations (id, name, type, status, approval_status, is_verified)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Team Ayurlahi',
  'AYURLAHI_TEAM',
  'active',
  'approved',
  true
)
ON CONFLICT DO NOTHING;

-- Comments
COMMENT ON TABLE organisations IS 'AYURLAHI_TEAM organisation created for internal team members';





