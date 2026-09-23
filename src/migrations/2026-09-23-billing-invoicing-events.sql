-- Billing & Invoicing Tracking -- see
-- scope/Billing_Invoicing_Tracking_Implementation_Plan.md. Six new
-- registry codes closing confirmed real gaps: InvoicesScreen's detail is
-- an inline state expansion (invisible to screen_view's navigation-only
-- coverage), and print/share on both invoices and bills had no
-- success/failure telemetry at all. "Marked paid" deliberately excluded
-- -- an accountability/business-state question for a future audit-trail
-- phase, not behavioral telemetry (invoices/billing currently have zero
-- audit coverage at all).

INSERT INTO usage_event_types (code, name, is_active) VALUES
  ('invoice_viewed', 'Invoice Viewed', true),
  ('invoice_printed', 'Invoice Printed', true),
  ('invoice_shared', 'Invoice Shared', true),
  ('bill_viewed', 'Bill Viewed', true),
  ('bill_printed', 'Bill Printed', true),
  ('bill_shared', 'Bill Shared', true);
