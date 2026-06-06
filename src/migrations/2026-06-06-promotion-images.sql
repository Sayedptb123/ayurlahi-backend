-- ============================================================================
-- 2026-06-06-promotion-images
-- Purpose: Phase 19 — let a promotion carry MULTIPLE images (carousel). Adds
--          images jsonb (array of URLs). image_url stays as the first-image
--          fallback for older clients. Idempotent.
-- ============================================================================
BEGIN;
ALTER TABLE "public"."promotions" ADD COLUMN IF NOT EXISTS "images" jsonb;
-- Backfill: seed the array from the existing single image_url where present.
UPDATE "public"."promotions"
   SET "images" = jsonb_build_array("image_url")
 WHERE "image_url" IS NOT NULL AND "images" IS NULL;
COMMIT;
