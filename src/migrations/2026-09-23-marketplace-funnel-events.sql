-- Marketplace Funnel Tracking -- see
-- scope/Marketplace_Funnel_Tracking_Implementation_Plan.md. Two new
-- registry codes closing the confirmed real gaps in the medicine
-- marketplace funnel (cart removal, checkout failure). No detail-view or
-- cart-view events added -- neither screen exists in this app, confirmed
-- by tracing the actual code before writing this migration.

INSERT INTO usage_event_types (code, name, is_active) VALUES
  ('remove_from_cart', 'Remove From Cart', true),
  ('checkout_failed', 'Checkout Failed', true);
