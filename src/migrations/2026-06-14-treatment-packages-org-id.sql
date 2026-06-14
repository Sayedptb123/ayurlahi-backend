-- Rename treatment_packages."clinicId" → "organisation_id" to match the
-- naming convention used by every other table in the schema.
-- No data changes. No FK constraints exist on this column to drop/recreate.
-- Application behaviour is unchanged — TypeORM mapping is updated in the entity.

ALTER TABLE treatment_packages
    RENAME COLUMN "clinicId" TO "organisation_id";
