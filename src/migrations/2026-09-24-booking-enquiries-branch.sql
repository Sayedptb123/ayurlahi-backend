-- Branch scoping Phase 7 / G12 (scope/Branch_Scoping_Remediation_Plan_2026-09-24.md):
-- enquiries (contact names + phones) had no branch, so every branch saw every
-- enquiry. Adds booking_enquiries.branch_id and backfills it from evidence only:
--   1. the branch of the enquiry's booking(s), when they agree on one branch;
--   2. else the organisation's single live branch (unambiguous);
--   3. else NULL — correct for organisations with no branches; any row left
--      NULL in a multi-branch organisation is reported below for review.
-- On staging (2026-09-24) that is: CNS 4 → Main Branch; Anjala Ayur Home 6 and
-- "Pms" 2 stay NULL (no branches); nothing needs review.
--
-- Rollback: ALTER TABLE booking_enquiries DROP COLUMN branch_id;

BEGIN;
ALTER TABLE booking_enquiries
  ADD COLUMN IF NOT EXISTS branch_id uuid NULL REFERENCES branches(id);
CREATE INDEX IF NOT EXISTS idx_booking_enquiries_org_branch
  ON booking_enquiries (organisation_id, branch_id);

-- 1. From the enquiry's booking(s), when they all carry the same branch.
UPDATE booking_enquiries e
   SET branch_id = x.branch_id
  FROM (SELECT enquiry_id, min(branch_id::text)::uuid AS branch_id
          FROM room_bookings
         WHERE enquiry_id IS NOT NULL AND branch_id IS NOT NULL
         GROUP BY enquiry_id
        HAVING count(DISTINCT branch_id) = 1) x
 WHERE e.id = x.enquiry_id AND e.branch_id IS NULL;

-- 2. Organisations with exactly one live branch.
UPDATE booking_enquiries e
   SET branch_id = b.id
  FROM branches b
 WHERE b.organisation_id = e.organisation_id
   AND b.deleted_at IS NULL
   AND e.branch_id IS NULL
   AND (SELECT count(*) FROM branches x WHERE x.organisation_id = e.organisation_id AND x.deleted_at IS NULL) = 1;
COMMIT;

-- Review list: NULL-branch enquiries in organisations that have branches.
SELECT o.name AS organisation, e.id, e.contact_name, e.created_at
  FROM booking_enquiries e JOIN organisations o ON o.id = e.organisation_id
 WHERE e.branch_id IS NULL AND e.deleted_at IS NULL
   AND EXISTS (SELECT 1 FROM branches b WHERE b.organisation_id = e.organisation_id AND b.deleted_at IS NULL);
