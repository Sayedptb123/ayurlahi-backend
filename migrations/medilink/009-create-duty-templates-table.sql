-- ============================================
-- Phase 3: Duty Assignment - Duty Templates Table
-- MediLink - A product from Team Ayurlahi
-- ============================================

CREATE TABLE duty_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  
  -- Template details
  name VARCHAR(255) NOT NULL, -- "Weekly Rotation", "Monthly Schedule"
  description TEXT,
  
  -- Schedule pattern (JSONB for flexibility)
  schedule_pattern JSONB NOT NULL, -- Defines the duty assignments
  /*
  Example:
  {
    "type": "weekly", // "weekly", "monthly", "custom"
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "assignments": [
      {
        "day_of_week": 1, // Monday = 1
        "staff_id": "uuid",
        "duty_type_id": "uuid"
      },
      {
        "day_of_week": 2,
        "staff_id": "uuid",
        "duty_type_id": "uuid"
      }
    ]
  }
  */
  
  -- Recurrence
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern JSONB, -- For recurring templates
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_duty_templates_org ON duty_templates(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_duty_templates_branch ON duty_templates(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_duty_templates_active ON duty_templates(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_duty_templates_deleted ON duty_templates(deleted_at) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE duty_templates IS 'Duty templates table - reusable duty schedule templates';
COMMENT ON COLUMN duty_templates.schedule_pattern IS 'JSONB pattern defining the duty assignments';





