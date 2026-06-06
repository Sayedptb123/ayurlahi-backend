-- ============================================================================
-- 2026-06-05-asset-management
-- Purpose: Create tables for asset categories, assets, and asset maintenance
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."asset_categories" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organisation_id" UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  "name" VARCHAR(100) NOT NULL,
  "code" VARCHAR(50),
  "depreciation_rate" DECIMAL(5,2),
  "depreciation_method" VARCHAR(50) DEFAULT 'straight_line' CHECK (depreciation_method IN ('straight_line','declining_balance')),
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "public"."assets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organisation_id" UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  "branch_id" UUID REFERENCES branches(id),
  "category_id" UUID NOT NULL REFERENCES asset_categories(id),
  "asset_code" VARCHAR(100) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "brand" VARCHAR(100),
  "model" VARCHAR(100),
  "serial_number" VARCHAR(100),
  "purchase_date" DATE,
  "purchase_price" DECIMAL(12,2),
  "vendor" VARCHAR(255),
  "purchase_order_id" UUID REFERENCES purchase_orders(id),
  "location" VARCHAR(255),
  "assigned_to_staff_id" UUID REFERENCES staff(id),
  "status" VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','maintenance','retired','disposed','lost')),
  "last_maintenance_date" DATE,
  "next_maintenance_date" DATE,
  "maintenance_interval_days" INT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "public"."asset_maintenance" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "asset_id" UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  "maintenance_type" VARCHAR(50) CHECK (maintenance_type IN ('routine','repair','calibration','upgrade')),
  "maintenance_date" DATE NOT NULL,
  "cost" DECIMAL(10,2),
  "service_provider" VARCHAR(255),
  "description" TEXT,
  "next_maintenance_date" DATE,
  "payment_id" UUID, -- links to expenses table if integrated
  "performed_by" UUID REFERENCES users(id),
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Partial unique index for active assets
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_unique_code_active
  ON assets(organisation_id, asset_code) WHERE deleted_at IS NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_asset_categories_org ON asset_categories(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assets_org ON assets(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_asset ON asset_maintenance(asset_id);

INSERT INTO "public"."migrations" ("name")
VALUES ('2026-06-05-asset-management')
ON CONFLICT ("name") DO NOTHING;

COMMIT;
