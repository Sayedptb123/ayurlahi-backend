-- "Can't find it? Request a product" — lets a clinic ask for a medicine
-- that isn't in any onboarded manufacturer's digitized catalog yet.
-- Ayurlahi ops (FIELD_STAFF/TEAM_LEAD/SUPPORT, notified on creation) then
-- either gets a manufacturer to add it or handles it as a one-off, and
-- resolves the request (fulfilled/declined), notifying the clinic back.
BEGIN;

CREATE TABLE IF NOT EXISTS product_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  requested_by uuid NOT NULL REFERENCES users(id),
  product_name varchar(255) NOT NULL,
  manufacturer_hint varchar(255),
  notes text,
  status varchar(20) NOT NULL DEFAULT 'pending',
  resolution_notes text,
  resolved_by uuid REFERENCES users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_product_request_status CHECK (status IN ('pending', 'in_progress', 'fulfilled', 'declined'))
);

CREATE INDEX IF NOT EXISTS idx_product_requests_org ON product_requests (organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_product_requests_status ON product_requests (status) WHERE deleted_at IS NULL;

COMMIT;
