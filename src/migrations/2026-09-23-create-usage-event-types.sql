-- Usage Event Registry (Tracking Phase 1) -- see
-- scope/Usage_Event_Registry_Implementation_Plan.md. Hardens the existing
-- usage_events pipeline: eventType was previously a free-form varchar with
-- no server-side validation. Seeds all 25 currently-live codes (14
-- load-bearing -- consumed by existing analytics queries -- plus 11
-- write-only) exactly as-is. No renames.

CREATE TABLE usage_event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  allowed_metadata_keys JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO usage_event_types (code, name, is_active) VALUES
  ('app_open', 'App Open', true),
  ('app_foreground', 'App Foregrounded', true),
  ('app_background', 'App Backgrounded', true),
  ('screen_view', 'Screen View', true),
  ('search', 'Search', true),
  ('add_to_cart', 'Add to Cart', true),
  ('promo_impression', 'Promo Impression', true),
  ('promo_click', 'Promo Click', true),
  ('promo_dismiss', 'Promo Dismiss', true),
  ('push_notification_click', 'Push Notification Click', true),
  ('checkout_started', 'Checkout Started', true),
  ('checkout_completed', 'Checkout Completed', true),
  ('appointment_created', 'Appointment Created', true),
  ('patient_created', 'Patient Created', true),
  ('registration_started', 'Registration Started', true),
  ('registration_completed', 'Registration Completed', true),
  ('bill_created', 'Bill Created', true),
  ('booking_created', 'Booking Created', true),
  ('booking_edited', 'Booking Edited', true),
  ('booking_cancelled', 'Booking Cancelled', true),
  ('booking_confirmed', 'Booking Confirmed', true),
  ('booking_checked_in', 'Booking Checked In', true),
  ('booking_removed', 'Booking Removed', true),
  ('booking_refund_recorded', 'Booking Refund Recorded', true),
  ('booking_promoted_to_patient', 'Booking Promoted to Patient', true);
