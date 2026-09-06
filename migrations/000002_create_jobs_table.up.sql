CREATE TABLE IF NOT EXISTS jobs (
    id            bigserial PRIMARY KEY,
    public_id     uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    image_id      bigint NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    status        text NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    error_message text,
    queued_at     timestamptz NOT NULL DEFAULT now(),
    started_at    timestamptz,
    completed_at  timestamptz
);

-- Supports ClaimNext's "next queued job" query, which orders by queued_at ascending and then id ascending to break ties.
CREATE INDEX IF NOT EXISTS idx_jobs_status_queued_at ON jobs (status, queued_at);
