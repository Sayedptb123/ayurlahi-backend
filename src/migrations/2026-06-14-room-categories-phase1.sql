-- Phase 1: Room Categories master entity (ADR-002)
-- Creates room_categories and links rooms to it via nullable FK.
-- Drops rooms.type (varchar — staging test data only, no data migration needed).

CREATE TABLE room_categories (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  uuid NOT NULL REFERENCES organisations(id),
    name             varchar(100) NOT NULL,
    is_active        boolean NOT NULL DEFAULT true,
    created_at       timestamp NOT NULL DEFAULT now(),
    updated_at       timestamp NOT NULL DEFAULT now(),
    deleted_at       timestamp,
    UNIQUE (organisation_id, name)
);

ALTER TABLE rooms ADD COLUMN room_category_id uuid REFERENCES room_categories(id);

ALTER TABLE rooms DROP COLUMN type;
