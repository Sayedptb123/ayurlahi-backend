import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import type { AuditAction, AuditSeverity, AuditSource } from '../audit.types';

/**
 * Append-only accountability trail. No update/delete methods exist on any
 * repository for this entity anywhere in the codebase, by convention --
 * see scope/Audit_Trail_Accountability_Scope_v4.md "Immutability". True
 * DB-level enforcement (a restricted audit_writer role) is a tracked
 * follow-up, not implemented in this phase.
 */
@Entity('audit_logs')
export class AuditLog {
  // NOTE: Postgres's actual primary key is the composite (id, created_at)
  // -- required because the table is partitioned by created_at (see
  // 2026-09-23-create-audit-logs.sql). TypeORM's metadata here only
  // describes `id`. Not a problem for the insert-only path this phase
  // uses (nothing queries or upserts by PK), but don't build a
  // find-by-id/update-by-id audit read API against this entity without
  // first deciding how to represent the composite key -- tracked as a
  // follow-up, not fixed here.
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Nullable: a "no account matches this identifier at all" security event
  // (unknown-account login/OTP attempt) has no user row and therefore no
  // organisation membership to attach -- see
  // 2026-09-23-audit-logs-nullable-org.sql.
  //
  // Every column below has an explicit `type:` even though most look like
  // they wouldn't need one. TypeScript's emitted design:type metadata for
  // a union property (string | null, or a custom string-literal-union
  // alias like AuditAction) degrades to `Object` at runtime -- TypeORM
  // can't map that to a Postgres type and DataSource.initialize() throws
  // DataTypeNotSupportedError. This was never caught by `npm run build`
  // (pure TS compile, no TypeORM metadata validation) or by any Jest
  // test (all of them construct AuditService with a plain mocked
  // repository object, never a real DataSource) -- only surfaced the
  // first time the real app was actually booted against Postgres.
  @Column({ type: 'uuid', name: 'organisation_id', nullable: true })
  organisationId: string | null;

  @Column({ type: 'uuid', name: 'branch_id', nullable: true })
  branchId: string | null;

  // Nullable for the same reason organisationId is -- see above.
  @Column({ type: 'varchar', name: 'org_type', nullable: true })
  orgType: string | null;

  @Column({ type: 'varchar', name: 'entity_type' })
  entityType: string;

  @Column({ type: 'uuid', name: 'entity_id', nullable: true })
  entityId: string | null;

  @Column({ type: 'varchar' })
  action: AuditAction;

  @Column({ type: 'varchar' })
  severity: AuditSeverity;

  @Column({ type: 'uuid', name: 'actor_user_id', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar', name: 'actor_role', nullable: true })
  actorRole: string | null;

  @Column({ type: 'varchar' })
  source: AuditSource;

  @Column({ type: 'varchar', name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', name: 'user_agent', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', name: 'request_id', nullable: true })
  requestId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, { from: unknown; to: unknown }> | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
