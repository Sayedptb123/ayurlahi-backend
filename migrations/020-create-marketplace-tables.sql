BEGIN;

-- ============================================================================
-- 1. MANUFACTURERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "manufacturers" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL UNIQUE,
    "companyName" VARCHAR(255) NOT NULL,
    "gstin" VARCHAR(50) NOT NULL UNIQUE,
    "licenseNumber" VARCHAR(100) NOT NULL UNIQUE,
    "address" TEXT NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "pincode" VARCHAR(10) NOT NULL,
    "country" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(20),
    "whatsappNumber" VARCHAR(20),
    "approvalStatus" VARCHAR(20) DEFAULT 'pending' NOT NULL,
    "rejectionReason" TEXT,
    "documents" JSONB,
    "isVerified" BOOLEAN DEFAULT false NOT NULL,
    "commissionRate" DECIMAL(5, 2) DEFAULT 0 NOT NULL,
    "approvedAt" TIMESTAMP,
    "approvedBy" UUID,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" TIMESTAMP,
    CONSTRAINT "fk_manufacturers_user" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_manufacturers_userId" ON "manufacturers"("userId");
CREATE INDEX IF NOT EXISTS "IDX_manufacturers_gstin" ON "manufacturers"("gstin");

-- ============================================================================
-- 2. PRODUCTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "products" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "manufacturerId" UUID NOT NULL,
    "sku" VARCHAR(100) NOT NULL UNIQUE,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100),
    "batchNumber" VARCHAR(50),
    "expiryDate" DATE,
    "manufacturingDate" DATE,
    "price" DECIMAL(10, 2) NOT NULL,
    "gstRate" DECIMAL(10, 2) DEFAULT 0 NOT NULL,
    "stockQuantity" INTEGER DEFAULT 0 NOT NULL,
    "unit" VARCHAR(50),
    "minOrderQuantity" INTEGER DEFAULT 1 NOT NULL,
    "images" JSONB,
    "specifications" JSONB,
    "isActive" BOOLEAN DEFAULT true NOT NULL,
    "requiresPrescription" BOOLEAN DEFAULT false NOT NULL,
    "licenseNumber" VARCHAR(50),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" TIMESTAMP,
    CONSTRAINT "fk_products_manufacturer" FOREIGN KEY ("manufacturerId") REFERENCES "manufacturers" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_products_manufacturerId" ON "products"("manufacturerId");
CREATE INDEX IF NOT EXISTS "IDX_products_sku" ON "products"("sku");
CREATE INDEX IF NOT EXISTS "IDX_products_category" ON "products"("category");

-- ============================================================================
-- 3. ORDERS TABLE
-- ============================================================================
-- Create Enums if they don't exist
DO $$ BEGIN
    CREATE TYPE order_status_enum AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'disputed', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_source_enum AS ENUM ('web', 'whatsapp');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "orders" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clinicId" UUID NOT NULL,
    "orderNumber" VARCHAR(50) NOT NULL UNIQUE,
    "status" VARCHAR(20) DEFAULT 'pending' NOT NULL,
    "source" VARCHAR(20) DEFAULT 'web' NOT NULL,
    "whatsappMessageId" VARCHAR(100),
    "razorpayOrderId" VARCHAR(100),
    "subtotal" DECIMAL(12, 2) NOT NULL,
    "gstAmount" DECIMAL(12, 2) DEFAULT 0 NOT NULL,
    "shippingCharges" DECIMAL(12, 2) DEFAULT 0 NOT NULL,
    "platformFee" DECIMAL(12, 2) DEFAULT 0 NOT NULL,
    "totalAmount" DECIMAL(12, 2) NOT NULL,
    "shippingAddress" TEXT,
    "shippingCity" VARCHAR(100),
    "shippingDistrict" VARCHAR(100),
    "shippingState" VARCHAR(100),
    "shippingPincode" VARCHAR(10),
    "shippingPhone" VARCHAR(20),
    "shippingContactName" VARCHAR(100),
    "notes" TEXT,
    "confirmedAt" TIMESTAMP,
    "shippedAt" TIMESTAMP,
    "deliveredAt" TIMESTAMP,
    "cancelledAt" TIMESTAMP,
    "cancellationReason" TEXT,
    "cancelledBy" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" TIMESTAMP,
    CONSTRAINT "fk_orders_clinic" FOREIGN KEY ("clinicId") REFERENCES "clinics" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_orders_clinicId" ON "orders"("clinicId");
CREATE INDEX IF NOT EXISTS "IDX_orders_orderNumber" ON "orders"("orderNumber");
CREATE INDEX IF NOT EXISTS "IDX_orders_status" ON "orders"("status");

-- ============================================================================
-- 4. ORDER ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "order_items" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "manufacturerId" UUID NOT NULL,
    "productSku" VARCHAR(100) NOT NULL,
    "productName" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10, 2) NOT NULL,
    "gstRate" DECIMAL(5, 2) NOT NULL,
    "subtotal" DECIMAL(12, 2) NOT NULL,
    "gstAmount" DECIMAL(12, 2) NOT NULL,
    "totalAmount" DECIMAL(12, 2) NOT NULL,
    "commissionAmount" DECIMAL(12, 2) NOT NULL,
    "status" VARCHAR(20) DEFAULT 'pending' NOT NULL,
    "shippedQuantity" INTEGER DEFAULT 0 NOT NULL,
    "deliveredQuantity" INTEGER DEFAULT 0 NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" TIMESTAMP,
    CONSTRAINT "fk_order_items_order" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE CASCADE,
    CONSTRAINT "fk_order_items_product" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE
    -- Note: We generally don't cascade delete on manufacturer deletion for historical order data integrity
);

CREATE INDEX IF NOT EXISTS "IDX_order_items_orderId" ON "order_items"("orderId");
CREATE INDEX IF NOT EXISTS "IDX_order_items_productId" ON "order_items"("productId");
CREATE INDEX IF NOT EXISTS "IDX_order_items_manufacturerId" ON "order_items"("manufacturerId");
CREATE INDEX IF NOT EXISTS "IDX_order_items_status" ON "order_items"("status");

-- Add foreign key to users.manufacturer_id if it doesn't exist (circular dependency handling)
-- This is usually handled by keeping nullable and updating later, or via separate alter statement
-- The users table already has the column, we just need to ensure the constraint exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_users_manufacturer') THEN
        ALTER TABLE "users"
            ADD CONSTRAINT "FK_users_manufacturer"
            FOREIGN KEY ("manufacturer_id")
            REFERENCES "manufacturers"("id")
            ON DELETE SET NULL;
    END IF;
END $$;

COMMIT;
