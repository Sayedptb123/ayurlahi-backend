-- Custom Fields Lite (ADR-004)
-- Centre-configurable intake fields on booking enquiries.
-- Applied: 2026-06-17

CREATE TABLE IF NOT EXISTS booking_field_definitions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid        NOT NULL REFERENCES organisations(id),
  label           varchar(100) NOT NULL,
  field_key       varchar(50)  NOT NULL,
  field_type      varchar(20)  NOT NULL DEFAULT 'text',  -- text | number | date | select | textarea
  required        boolean      NOT NULL DEFAULT false,
  options_json    jsonb        NULL,                      -- string[] for select type only
  display_order   int          NOT NULL DEFAULT 0,
  is_active       boolean      NOT NULL DEFAULT true,
  created_at      timestamp    NOT NULL DEFAULT now(),
  updated_at      timestamp    NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_booking_field_defs_org
  ON booking_field_definitions (organisation_id)
  WHERE is_active = true;

COMMENT ON TABLE booking_field_definitions IS
  'Per-org custom field definitions for booking enquiries. Values stored as JSONB on booking_enquiries.additional_info.';

COMMENT ON COLUMN booking_field_definitions.field_key IS
  'Snake_case key used in additional_info JSONB. Unique per org. Stable — renaming breaks historical values.';

COMMENT ON COLUMN booking_field_definitions.field_type IS
  'V1 types: text | number | date | select | textarea. Search/filter/report on field values is out of scope in V1 (ADR-004 D1).';

-- Storage column on enquiries
ALTER TABLE booking_enquiries
  ADD COLUMN IF NOT EXISTS additional_info jsonb NULL;

COMMENT ON COLUMN booking_enquiries.additional_info IS
  'Org-defined custom field values. Keys match booking_field_definitions.field_key for the enquiry''s org.';
