-- Add product_id column to inventory_items table
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS product_id VARCHAR;

-- Add comment
COMMENT ON COLUMN inventory_items.product_id IS 'Links inventory item to marketplace product for easy reordering';
