-- ============================================================================
-- Migration: enable Row Level Security (deny-all) on every public table
-- Date:      2026-06-02
-- Author:    security hardening (Supabase Advisor: "RLS Disabled in Public")
-- ============================================================================
--
-- WHY THIS EXISTS
-- ---------------
-- Supabase auto-exposes the `public` schema through PostgREST at
--   https://<project-ref>.supabase.co/rest/v1/...
-- reachable with the *anon* API key, which is public by design. With RLS
-- disabled, anyone holding the project URL + anon key can read/write EVERY row
-- in EVERY table across ALL organisations — completely bypassing the NestJS
-- `req.user.organisationId` filtering that is our entire multi-tenancy model.
-- For a healthcare DB holding PHI, financial, and payroll data this is critical.
--
-- WHAT THIS DOES
-- --------------
-- Enables (but does NOT force) RLS on every base table in `public`, and creates
-- ZERO policies. Effect:
--   * Non-owner roles (anon, authenticated — i.e. PostgREST) -> DENY ALL.
--   * The table-OWNER role (`postgres`, which our backend connects as via the
--     session pooler) BYPASSES RLS by default, so the NestJS backend keeps
--     working with no code or query changes.
--
-- We deliberately do NOT use `FORCE ROW LEVEL SECURITY` — that would subject the
-- owner role to RLS too and break the backend.
--
-- DEFENSE IN DEPTH, NOT THE PRIMARY FIX
-- -------------------------------------
-- The primary fix is to disable the PostgREST Data API entirely (Supabase
-- dashboard -> Settings -> API -> Data API), since nothing in our stack uses it
-- (no @supabase/supabase-js, no anon key anywhere in the codebase). This
-- migration is the seatbelt: it keeps tables locked even if the Data API is ever
-- re-enabled or the anon key leaks.
--
-- HOW TO APPLY
-- ------------
--   psql "$DATABASE_URL" -f src/migrations/2026-06-02-enable-rls-public.sql
-- Idempotent: safe to run multiple times. Connect as the table owner (postgres).
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    RAISE NOTICE 'RLS enabled on public.%', r.tablename;
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- Verification (run after applying): every public table should show rowsecurity = true
-- ----------------------------------------------------------------------------
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY rowsecurity, tablename;
--
-- And confirm there are no permissive policies accidentally opening access:
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public';
-- (expected: 0 rows)
