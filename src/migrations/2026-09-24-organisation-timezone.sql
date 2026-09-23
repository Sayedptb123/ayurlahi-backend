-- G9 (scope/Cash_Management_MVP_Implementation_Plan_2026-09-24.md §2): business
-- dates ("today" for bills, payments, due-bill processing and, later, vouchers
-- and day close) are computed in the organisation's timezone, not UTC. Every
-- existing organisation gets Asia/Kolkata via the default. Additive only.
--
-- Rollback: ALTER TABLE organisation_settings DROP COLUMN timezone;

ALTER TABLE organisation_settings
  ADD COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata';
