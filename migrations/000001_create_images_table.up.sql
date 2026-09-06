CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS images (
    id                bigserial PRIMARY KEY,
    public_id         uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    original_filename text NOT NULL,
    stored_filename   text NOT NULL,
    media_type        text NOT NULL,
    size_bytes        bigint NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now()
);
