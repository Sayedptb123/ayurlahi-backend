-- AC supplement pricing (ADR-002 D12)
--
-- Changes:
--   1. room_category_pricing.price → base_price  (semantic rename: the matrix stores base price, AC adds on top)
--   2. room_category_pricing.ac_supplement_per_day  (NULL = centre doesn't charge for AC in this cell)
--   3. room_bookings.ac_required  (did this patient request AC for their stay)

ALTER TABLE room_category_pricing
    RENAME COLUMN price TO base_price;

ALTER TABLE room_category_pricing
    ADD COLUMN ac_supplement_per_day DECIMAL(10, 2) NULL;

ALTER TABLE room_bookings
    ADD COLUMN ac_required BOOLEAN NOT NULL DEFAULT false;
