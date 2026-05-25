CREATE TABLE IF NOT EXISTS user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  title varchar(255) NOT NULL,
  body text NOT NULL,
  data jsonb,
  "isRead" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications("userId");
CREATE INDEX IF NOT EXISTS idx_user_notifications_created ON user_notifications("createdAt" DESC);
