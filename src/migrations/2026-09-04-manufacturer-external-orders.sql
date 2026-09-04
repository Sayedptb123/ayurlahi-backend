-- ============================================================================
-- 2026-09-04-manufacturer-external-orders
-- Purpose: let a manufacturer (e.g. PMS) enter an order they received
-- directly from a clinic outside the platform (WhatsApp/phone) as a real
-- Ayurlahi order + invoice, for clinics they already have an approved
-- business relationship with. See
-- scope/PMS_External_Order_Feature_Scope_2026-09-04.md for the full design.
--
-- manufacturer_external_order_access is an authorization boundary, not a
-- revival of the clinic_manufacturer_relationships table rejected in
-- Order_Fulfillment_Routing_Plan.md -- that one branched fulfillment routing
-- with only one possible outcome (dead weight). This one actually gates
-- create-vs-403 per manufacturer/clinic pair, granted by Ayurlahi Team.
--
-- order_items.catalog_price_at_order preserves the real catalog price for
-- audit when a manufacturer enters an agreed price that differs from it
-- (external orders only -- stays NULL for normal marketplace orders, where
-- it would just duplicate unit_price).
--
-- No change needed for the negotiated price or GST/HSN itself -- those already
-- flow through order_items.unit_price/gst_rate/hsn_code untouched.
-- order_source's EXTERNAL value and metadata.originalChannel (whatsapp/phone)
-- are application-level (varchar column, jsonb column already exist) -- no
-- schema change needed for those.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS manufacturer_external_order_access (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id  uuid NOT NULL REFERENCES organisations(id),
  clinic_id        uuid NOT NULL REFERENCES organisations(id),
  granted_by       uuid NOT NULL REFERENCES users(id),
  is_active        boolean NOT NULL DEFAULT true,
  notes            text NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz NULL,
  UNIQUE (manufacturer_id, clinic_id)
);

CREATE INDEX IF NOT EXISTS idx_mfg_ext_access_manufacturer ON manufacturer_external_order_access (manufacturer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mfg_ext_access_clinic ON manufacturer_external_order_access (clinic_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE manufacturer_external_order_access IS 'Ayurlahi-Team-granted authorization for a manufacturer to create external (WhatsApp/phone) orders on behalf of a specific clinic they already have a business relationship with. Not a general relationship model -- single purpose, gates order creation only.';

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS catalog_price_at_order numeric(10,2) NULL;

COMMENT ON COLUMN order_items.catalog_price_at_order IS 'Snapshot of products.price at order creation, for external orders where unit_price was manufacturer-entered and may differ from catalog. NULL for normal marketplace orders (unit_price already equals catalog price there).';

COMMIT;
