-- ============================================================================
-- 2026-06-06-promotions-analytics-base
-- Purpose: Canonical, idempotent creation of the Phase 19 (Promotions) and
--          Phase 20 (Usage Analytics) tables. Supersedes the ad-hoc
--          migrations/040-create-promotions-and-analytics-tables.sql (different
--          folder / not idempotent / missing the images column & nullable text).
--          Final shapes: promotions.title/body are NULLABLE (text optional) and
--          promotions.images jsonb exists. Safe to re-run.
-- ============================================================================

BEGIN;

-- ---- Phase 19: Promotions ----
CREATE TABLE IF NOT EXISTS "public"."promotions" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title"             VARCHAR(255),
  "body"              TEXT,
  "image_url"         TEXT,
  "images"            JSONB,
  "placement"         VARCHAR(50) NOT NULL CHECK (placement IN ('POPUP', 'BANNER', 'BOTH')),
  "targeting_criteria" JSONB,
  "priority"          INT DEFAULT 0,
  "starts_at"         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ends_at"           TIMESTAMP,
  "is_active"         BOOLEAN DEFAULT true,
  "created_by"        UUID REFERENCES "public"."users"("id"),
  "created_at"        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"        TIMESTAMP
);
-- In case an older promotions table already exists, bring it to the final shape:
ALTER TABLE "public"."promotions" ALTER COLUMN "title" DROP NOT NULL;
ALTER TABLE "public"."promotions" ALTER COLUMN "body"  DROP NOT NULL;
ALTER TABLE "public"."promotions" ADD COLUMN IF NOT EXISTS "images" JSONB;

CREATE INDEX IF NOT EXISTS "idx_promotions_active_date"
  ON "public"."promotions" ("starts_at", "ends_at") WHERE is_active = true AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "public"."promotion_events" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "promotion_id"    UUID NOT NULL REFERENCES "public"."promotions"("id") ON DELETE CASCADE,
  "user_id"         UUID NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "organisation_id" UUID REFERENCES "public"."organisations"("id"),
  "event_type"      VARCHAR(50) NOT NULL CHECK (event_type IN ('IMPRESSION', 'CLICK', 'DISMISS')),
  "occurred_at"     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_promotion_events_user"
  ON "public"."promotion_events" ("user_id", "promotion_id", "event_type");

-- ---- Phase 20: Usage Analytics ----
CREATE TABLE IF NOT EXISTS "public"."usage_events" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organisation_id" UUID REFERENCES "public"."organisations"("id"),
  "user_id"         UUID REFERENCES "public"."users"("id"),
  "event_type"      VARCHAR(100) NOT NULL,
  "screen_name"     VARCHAR(100),
  "metadata"        JSONB,
  "platform"        VARCHAR(50),
  "app_version"     VARCHAR(50),
  "session_id"      VARCHAR(100),
  "occurred_at"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_usage_events_org_date" ON "public"."usage_events" ("organisation_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "idx_usage_events_type" ON "public"."usage_events" ("event_type");

COMMIT;
