-- Phase 2: Room Pricing Matrix (ADR-002)
-- Creates room_category_pricing (category × package → price)
-- and room_pricing_overrides (room-level exceptions).

CREATE TABLE room_category_pricing (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id   uuid NOT NULL REFERENCES organisations(id),
    room_category_id  uuid NOT NULL REFERENCES room_categories(id),
    package_id        uuid NOT NULL REFERENCES treatment_packages(id),
    price             numeric(10,2) NOT NULL,
    created_at        timestamp NOT NULL DEFAULT now(),
    updated_at        timestamp NOT NULL DEFAULT now(),
    deleted_at        timestamp,
    UNIQUE (room_category_id, package_id)
);

CREATE TABLE room_pricing_overrides (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  uuid NOT NULL REFERENCES organisations(id),
    room_id          uuid NOT NULL REFERENCES rooms(id),
    package_id       uuid NOT NULL REFERENCES treatment_packages(id),
    price            numeric(10,2) NOT NULL,
    created_at       timestamp NOT NULL DEFAULT now(),
    updated_at       timestamp NOT NULL DEFAULT now(),
    deleted_at       timestamp,
    UNIQUE (room_id, package_id)
);
