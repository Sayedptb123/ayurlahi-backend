-- Migration: add assigned_to_doctor_id to staff_tasks
ALTER TABLE staff_tasks
  ADD COLUMN IF NOT EXISTS "assignedToDoctorId" uuid REFERENCES doctors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_staff_tasks_doctor ON staff_tasks("assignedToDoctorId");
