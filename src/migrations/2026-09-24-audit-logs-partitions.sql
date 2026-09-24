-- F6 (scope/Cash_MVP_Schema_Review_2026-09-24.md §8): audit_logs is
-- partitioned by month on created_at, but 2026-09-23-create-audit-logs.sql
-- only created September and October 2026, with no default partition and
-- nothing that adds more. AuditService.record() awaits its insert and login
-- awaits record(), so from 2026-11-01 00:00 UTC (05:30 IST) every login and
-- every other audited action would fail with a 500.
--
-- This adds one idempotent function that creates any missing monthly
-- partition from the current month through a given date, with RLS enabled
-- on each (see _README.md step 3), and seeds partitions through December
-- 2027. The backend calls the same function at startup and daily to keep
-- three months ahead (AuditPartitionService). Audit/login behaviour is
-- unchanged.
--
-- Boundaries are UTC midnights, matching the existing partitions, which were
-- created from date literals in a UTC session.
--
-- Rollback: DROP FUNCTION ensure_audit_log_partitions(date);
--   (partitions that already hold rows must be kept; empty future ones can be
--   dropped with DROP TABLE audit_logs_YYYY_MM.)

BEGIN;

CREATE OR REPLACE FUNCTION ensure_audit_log_partitions(p_until DATE)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  m       DATE := date_trunc('month', now() AT TIME ZONE 'UTC')::date;
  last_m  DATE := date_trunc('month', p_until)::date;
  part    TEXT;
  created INTEGER := 0;
BEGIN
  WHILE m <= last_m LOOP
    part := format('audit_logs_%s', to_char(m, 'YYYY_MM'));
    IF to_regclass('public.' || part) IS NULL THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.audit_logs FOR VALUES FROM (%L) TO (%L)',
        part,
        to_char(m, 'YYYY-MM-DD') || ' 00:00:00+00',
        to_char((m + INTERVAL '1 month')::date, 'YYYY-MM-DD') || ' 00:00:00+00'
      );
      created := created + 1;
    END IF;
    -- Also covers partitions made before this rule existed.
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', part);
    m := (m + INTERVAL '1 month')::date;
  END LOOP;
  RETURN created;
END;
$$;

-- Supabase exposes public-schema functions through the Data API (/rpc);
-- only the backend's owner role should run this.
REVOKE ALL ON FUNCTION ensure_audit_log_partitions(DATE) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION ensure_audit_log_partitions(DATE) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION ensure_audit_log_partitions(DATE) FROM authenticated';
  END IF;
END $$;

SELECT ensure_audit_log_partitions('2027-12-01');

COMMIT;
