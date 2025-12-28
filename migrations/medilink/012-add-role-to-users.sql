-- Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'clinic';

-- Create index on role for faster lookups if needed (optional but good practice)
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
