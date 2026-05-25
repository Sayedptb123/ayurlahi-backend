-- Migration 015: Create staff_tasks table

CREATE TABLE IF NOT EXISTS staff_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "organisationId" UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    "assignedToStaffId" UUID,
    "assignedToUserId" UUID,
    "assignedBy" UUID NOT NULL,
    "dueDate" DATE,
    "dueTime" TIME,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    "completedAt" TIMESTAMP,
    notes TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_tasks_organisation ON staff_tasks ("organisationId");
CREATE INDEX IF NOT EXISTS idx_staff_tasks_assigned_staff ON staff_tasks ("assignedToStaffId");
CREATE INDEX IF NOT EXISTS idx_staff_tasks_assigned_user ON staff_tasks ("assignedToUserId");
CREATE INDEX IF NOT EXISTS idx_staff_tasks_status ON staff_tasks (status);
