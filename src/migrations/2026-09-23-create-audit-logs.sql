-- Audit trail / accountability system, Phase 1 (shared infra + Auth).
-- See scope/Audit_Trail_Accountability_Scope_v4.md (architecture) and
-- scope/Audit_Trail_Phase1_Auth_Implementation_Plan.md (this phase).
--
-- One append-only table for both mutation audit and sensitive-record view
-- logging (deliberately not split yet -- no real production volume exists
-- to decide that from; see v4 "One table vs audit_view_logs"). No
-- updated_at/deleted_at columns by construction: rows are never modified
-- or removed at the application layer (v4 "Immutability" -- enforcement
-- here is code-level only for this phase, via AuditService never
-- exposing an update/delete path; true DB-level enforcement via a
-- restricted audit_writer role is a tracked follow-up, not done here).
--
-- Partitioned by month from the start, since this table is expected to
-- grow faster than any other in the schema once view-logging (a later
-- phase) is live. Future partition creation beyond what's created here
-- is an operational task that needs an owner, not something this
-- migration can complete once and forget (see the implementation plan's
-- "One small thing to watch").

BEGIN;

CREATE TABLE audit_logs (
    id                UUID NOT NULL DEFAULT gen_random_uuid(),
    organisation_id   UUID NOT NULL REFERENCES organisations(id),
    branch_id         UUID REFERENCES branches(id),
    org_type          VARCHAR(50) NOT NULL,

    entity_type       VARCHAR(100) NOT NULL,
    entity_id         UUID,
    action            VARCHAR(100) NOT NULL,
    severity          VARCHAR(20) NOT NULL,

    actor_user_id     UUID,
    actor_role        VARCHAR(50),
    source            VARCHAR(20) NOT NULL,
    ip_address        VARCHAR(64),
    user_agent        VARCHAR(500),
    request_id        VARCHAR(100),

    changes           JSONB,
    reason            TEXT,
    metadata          JSONB,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Postgres requires a partitioned table's primary key to include the
    -- partition column -- id alone stays effectively unique in practice
    -- (gen_random_uuid()), just not uniqueness-enforced by the DB beyond
    -- this composite. Standard trade-off for partitioned tables.
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2026_09 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE audit_logs_2026_10 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE INDEX idx_audit_logs_org ON audit_logs (organisation_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_user_id, created_at DESC);
CREATE INDEX idx_audit_logs_severity ON audit_logs (severity, created_at DESC)
    WHERE severity IN ('sensitive', 'critical');

COMMIT;
