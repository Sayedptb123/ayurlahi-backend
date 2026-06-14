-- Phase 4: Remove deprecated price columns (ADR-002 D8)
-- All booking creation paths now use the pricing resolution hierarchy.
-- rooms.price_per_day and treatment_packages.price are no longer read by the application.

ALTER TABLE rooms DROP COLUMN price_per_day;
ALTER TABLE treatment_packages DROP COLUMN price;
