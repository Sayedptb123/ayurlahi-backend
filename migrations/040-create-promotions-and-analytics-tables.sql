-- Phase 19: Marketing Promotions

CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  placement VARCHAR(50) NOT NULL CHECK (placement IN ('POPUP', 'BANNER', 'BOTH')),
  targeting_criteria JSONB, -- e.g., {"roles": ["CLINIC"], "capabilities": ["hasPostnatalCare"]}
  priority INT DEFAULT 0,
  starts_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ends_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_promotions_active_date ON promotions(starts_at, ends_at) WHERE is_active = true AND deleted_at IS NULL;

CREATE TABLE promotion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organisation_id UUID REFERENCES organisations(id),
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('IMPRESSION', 'CLICK', 'DISMISS')),
  occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_promotion_events_user ON promotion_events(user_id, promotion_id, event_type);


-- Phase 20: Usage Analytics & Telemetry

CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id), -- Nullable for pre-login events
  user_id UUID REFERENCES users(id), -- Nullable for pre-login events
  event_type VARCHAR(100) NOT NULL, -- e.g., 'screen_view', 'add_to_cart', 'form_abandoned', 'search_executed', 'push_opened'
  screen_name VARCHAR(100),
  metadata JSONB, -- Catch-all for extra properties like search_query, offline_queue_size, etc.
  platform VARCHAR(50), -- 'ios', 'android', 'web'
  app_version VARCHAR(50),
  session_id VARCHAR(100),
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usage_events_org_date ON usage_events(organisation_id, occurred_at);
CREATE INDEX idx_usage_events_type ON usage_events(event_type);
