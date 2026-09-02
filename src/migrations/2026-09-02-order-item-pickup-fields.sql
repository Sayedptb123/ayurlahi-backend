-- ============================================================================
-- 2026-09-02-order-item-pickup-fields
-- Purpose: support the universal Ayurlahi-managed fulfillment workflow
-- (clinic -> Ayurlahi + manufacturer notified -> manufacturer packs ->
-- Ayurlahi staff picks up -> Ayurlahi delivers). See
-- scope/Order_Fulfillment_Routing_Plan.md for the full design discussion.
-- No new table, no routing/mode field -- there's only one workflow today.
-- assigned_user_id references users(id), not staff(id): Ayurlahi Team
-- members (FIELD_STAFF/TEAM_LEAD/etc.) are organisation_users rows linked
-- to users, never rows in the clinic-HR `staff` table.
-- ============================================================================

BEGIN;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS picked_up_at timestamptz NULL;

COMMENT ON COLUMN order_items.assigned_user_id IS 'Ayurlahi Team member (organisation_users -> users) responsible for collecting this item from the manufacturer. Assignment is distinct from pickup -- see picked_up_at.';
COMMENT ON COLUMN order_items.picked_up_at IS 'Set when assigned_user_id has physically collected the packed item from the manufacturer. status=SHIPPED means this has happened.';

COMMIT;
