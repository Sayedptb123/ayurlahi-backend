-- Adds HSN code + MRP snapshot to order_items, HSN code to products, and
-- seller (manufacturer) address fields so invoices can show the full set of
-- details a real GST tax invoice needs (HSN, MRP, seller/buyer GSTIN+address),
-- not just totals.
BEGIN;

ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code varchar(20);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS hsn_code varchar(20);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS mrp numeric(10,2);

ALTER TABLE manufacturer_profiles ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE manufacturer_profiles ADD COLUMN IF NOT EXISTS city varchar(100);
ALTER TABLE manufacturer_profiles ADD COLUMN IF NOT EXISTS state varchar(100);
ALTER TABLE manufacturer_profiles ADD COLUMN IF NOT EXISTS pincode varchar(20);
ALTER TABLE manufacturer_profiles ADD COLUMN IF NOT EXISTS phone varchar(20);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "manufacturerDetails" jsonb;

-- Backfill HSN for PMS's catalog — every real PMS invoice seen so far uses
-- HSN 30049011 uniformly (Ayurvedic medicaments), including the 6 products
-- added during the 2026-08-26 invoice backfill.
UPDATE products SET hsn_code = '30049011'
WHERE manufacturer_id = 'a503aa07-2e04-4824-9325-581e929915e7' AND hsn_code IS NULL;

-- Backfill PMS's real registered address from Tax Invoice No.1 (26/08/2026)
UPDATE manufacturer_profiles
SET address = '7/517 Puzhakkatiri Post', city = 'Malappuram', state = 'Kerala', pincode = '679321', phone = '04933-254674'
WHERE organisation_id = 'a503aa07-2e04-4824-9325-581e929915e7' AND address IS NULL;

COMMIT;
