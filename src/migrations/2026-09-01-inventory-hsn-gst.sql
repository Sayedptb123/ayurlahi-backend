-- ============================================================================
-- 2026-09-01-inventory-hsn-gst
-- Purpose: inventory_items had no place to record HSN code or GST rate,
-- discovered while entering an off-platform supplier invoice (PMS Ayurvedic
-- Research Centre -> SAIFIS HEALTH CARE) as opening stock. Adds both as
-- optional per-item fields so tax-compliance data travels with the stock
-- record it came from, without forcing every inventory item (most of which
-- are entered manually with no invoice behind them) to supply either.
-- ============================================================================

BEGIN;

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS hsn_code varchar(20) NULL,
  ADD COLUMN IF NOT EXISTS gst_rate numeric(5,2) NULL;

COMMENT ON COLUMN inventory_items.hsn_code IS 'HSN/SAC code from the supplier invoice, if any. Optional — most manually-entered items will not have one.';
COMMENT ON COLUMN inventory_items.gst_rate IS 'GST rate (%) applied on the supplier invoice for this item, e.g. 5.00 or 18.00. Optional.';

COMMIT;
