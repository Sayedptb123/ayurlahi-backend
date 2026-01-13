-- Add status column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';

-- Update existing products based on isActive
UPDATE products 
SET status = CASE 
  WHEN "isActive" = true THEN 'ACTIVE'
  ELSE 'HIDDEN'
END
WHERE status IS NULL OR status = 'ACTIVE';

-- Update products that are soft-deleted
UPDATE products
SET status = 'HIDDEN', "isActive" = false
WHERE "deletedAt" IS NOT NULL AND status = 'ACTIVE';

-- Add check constraint for status
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_product_status'
  ) THEN
    ALTER TABLE products 
    ADD CONSTRAINT chk_product_status 
    CHECK (status IN ('DRAFT', 'ACTIVE', 'HIDDEN', 'ARCHIVED'));
  END IF;
END $$;

SELECT 'Product status column added successfully' AS result;
