-- Lets Team Ayurlahi transfer a product request to a specific manufacturer —
-- previously a request never reached any manufacturer at all, purely an
-- internal Ayurlahi note. Notifying stamps who/when so the manufacturer gets
-- a read-only view of just the requests routed to them.
BEGIN;

ALTER TABLE product_requests ADD COLUMN IF NOT EXISTS notified_manufacturer_id uuid REFERENCES organisations(id);
ALTER TABLE product_requests ADD COLUMN IF NOT EXISTS notified_at timestamptz;

COMMIT;
