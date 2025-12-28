-- ============================================
-- Phase 1: Foundation - Users Table (Simplified)
-- MediLink - A product from Team Ayurlahi
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE, -- Primary identifier
  email VARCHAR(255) UNIQUE, -- Optional
  password_hash VARCHAR(255), -- Optional (for platform users)
  is_active BOOLEAN DEFAULT true,
  is_email_verified BOOLEAN DEFAULT false,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_is_active ON users(is_active);

-- Comments
COMMENT ON TABLE users IS 'Users table - stores person information only (no organisation/role info)';
COMMENT ON COLUMN users.phone IS 'Primary identifier - must be unique';
COMMENT ON COLUMN users.email IS 'Optional email address';
COMMENT ON COLUMN users.password_hash IS 'Optional - only for users with platform login access';




