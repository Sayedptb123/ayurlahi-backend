-- Phase 3: Booking audit fields (ADR-002 D5)
-- suggested_price: what the pricing matrix resolved (null = no matrix hit, price was manual)
-- discount_reason: free text when total_price differs from suggested_price

ALTER TABLE room_bookings
    ADD COLUMN suggested_price numeric(10,2),
    ADD COLUMN discount_reason text;
