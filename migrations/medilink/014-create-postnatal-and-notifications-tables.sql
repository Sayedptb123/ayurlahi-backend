-- =====================================================
-- POSTNATAL CARE + NOTIFICATIONS - Database Migrations
-- =====================================================
-- This migration creates tables for:
--   1. push_tokens         (expo/FCM push notification tokens)
--   2. vitals              (postnatal mother vitals monitoring)
--   3. feeding_logs        (newborn feeding tracker)
--   4. newborn_assessments (APGAR + physical measurements)
-- And alters:
--   5. patients            (adds motherPatientId FK for baby-mother linkage)

-- =====================================================
-- 1. PUSH TOKENS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(512) NOT NULL UNIQUE,
  platform VARCHAR(20),   -- 'ios' | 'android'
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens("userId") WHERE "isActive" = true;

-- =====================================================
-- 2. VITALS TABLE (postnatal mother monitoring)
-- =====================================================
CREATE TABLE IF NOT EXISTS vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organisationId" UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  "patientId" UUID NOT NULL,
  "recordedBy" UUID REFERENCES users(id),
  "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Vital signs
  bp VARCHAR(20),            -- e.g. '120/80'
  temperature DECIMAL(5,2),  -- °C
  pulse INT,                 -- bpm
  spo2 DECIMAL(5,2),         -- %
  weight DECIMAL(6,2),       -- kg
  height DECIMAL(6,2),       -- cm
  "painScore" INT CHECK ("painScore" BETWEEN 0 AND 10),

  notes TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vitals_org ON vitals("organisationId");
CREATE INDEX IF NOT EXISTS idx_vitals_patient ON vitals("patientId");
CREATE INDEX IF NOT EXISTS idx_vitals_recorded ON vitals("recordedAt" DESC);

-- =====================================================
-- 3. FEEDING LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS feeding_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organisationId" UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  "patientId" UUID NOT NULL,       -- the newborn
  "motherPatientId" UUID,          -- optional FK to mother patient
  "recordedBy" UUID REFERENCES users(id),
  "feedingTime" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  "feedingType" VARCHAR(20) NOT NULL CHECK ("feedingType" IN ('breastfeed', 'formula', 'both')),
  "durationMinutes" INT,
  "quantityMl" DECIMAL(7,2),
  notes TEXT,

  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feeding_logs_org ON feeding_logs("organisationId");
CREATE INDEX IF NOT EXISTS idx_feeding_logs_patient ON feeding_logs("patientId");
CREATE INDEX IF NOT EXISTS idx_feeding_logs_time ON feeding_logs("feedingTime" DESC);

-- =====================================================
-- 4. NEWBORN ASSESSMENTS TABLE (APGAR scores)
-- =====================================================
CREATE TABLE IF NOT EXISTS newborn_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organisationId" UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  "patientId" UUID NOT NULL,       -- the newborn patient
  "assessedBy" UUID REFERENCES users(id),
  "assessmentTime" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assessmentType" VARCHAR(50) DEFAULT '1min', -- '1min' | '5min' | '10min'

  -- APGAR component scores (0-2 each)
  appearance INT CHECK (appearance BETWEEN 0 AND 2),
  pulse INT CHECK (pulse BETWEEN 0 AND 2),
  grimace INT CHECK (grimace BETWEEN 0 AND 2),
  activity INT CHECK (activity BETWEEN 0 AND 2),
  respiration INT CHECK (respiration BETWEEN 0 AND 2),
  "apgarTotal" INT CHECK ("apgarTotal" BETWEEN 0 AND 10),

  -- Physical measurements
  weight DECIMAL(8,2),           -- grams
  length DECIMAL(6,2),           -- cm
  "headCircumference" DECIMAL(6,2), -- cm
  "jaundiceLevel" VARCHAR(20) CHECK ("jaundiceLevel" IN ('NONE', 'MILD', 'MODERATE', 'SEVERE')),

  notes TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_newborn_assessments_org ON newborn_assessments("organisationId");
CREATE INDEX IF NOT EXISTS idx_newborn_assessments_patient ON newborn_assessments("patientId");

-- =====================================================
-- 5. ALTER PATIENTS TABLE — add motherPatientId
-- =====================================================
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS "motherPatientId" UUID;

COMMENT ON COLUMN patients."motherPatientId"
  IS 'For postnatal care: links a newborn patient record to the mother''s patient record';

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Postnatal care + notifications tables created successfully!';
  RAISE NOTICE 'Tables created/altered:';
  RAISE NOTICE '  - push_tokens (new)';
  RAISE NOTICE '  - vitals (new)';
  RAISE NOTICE '  - feeding_logs (new)';
  RAISE NOTICE '  - newborn_assessments (new)';
  RAISE NOTICE '  - patients.motherPatientId column (added)';
END $$;
