-- ============================================================================
-- 2026-06-06-treatment-protocols
-- Purpose: Phase 24C.3 — data-model groundwork for treatment→medicine BOMs
--          (e.g. "28-day Sutika package consumes X of each medicine"). The
--          forecasting CONSUMER stays deferred; this just lays the tables so a
--          protocol's expected consumption can be authored. Idempotent.
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS "public"."treatment_protocols" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organisation_id"  UUID NOT NULL REFERENCES "public"."organisations"("id") ON DELETE CASCADE,
  "name"             VARCHAR(150) NOT NULL,
  "description"      TEXT,
  "package_id"       UUID,             -- optional link to treatment_packages (no FK to stay decoupled)
  "is_active"        BOOLEAN DEFAULT true,
  "created_at"       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"       TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "public"."treatment_protocol_items" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "protocol_id"  UUID NOT NULL REFERENCES "public"."treatment_protocols"("id") ON DELETE CASCADE,
  "product_id"   UUID REFERENCES "public"."products"("id") ON DELETE SET NULL,
  "item_name"    VARCHAR(255) NOT NULL,
  "quantity"     NUMERIC(12,2) NOT NULL,   -- expected consumption per protocol run
  "unit"         VARCHAR(50),
  "created_at"   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"   TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_treatment_protocols_org" ON "public"."treatment_protocols" ("organisation_id");
CREATE INDEX IF NOT EXISTS "idx_treatment_protocol_items_protocol" ON "public"."treatment_protocol_items" ("protocol_id");

COMMIT;
