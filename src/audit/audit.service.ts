import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditAction, AuditSeverity, AuditSource, OrgType } from './audit.types';
import { filterAuditChanges } from './audit-field-policy';

const KNOWN_ACTIONS = new Set<AuditAction>([
  'create', 'update', 'soft_delete', 'restore', 'view',
  'login', 'login_failed', 'login_blocked', 'logout',
  'otp_requested', 'otp_request_failed', 'otp_verified', 'otp_verify_failed',
  'password_reset_completed', 'token_refresh',
  'permission_change', 'approve', 'reject', 'export',
]);

// Actions where a null actor is a legitimate outcome, not just a
// system/cron event -- an unresolvable identifier (unknown email/phone,
// or a valid OTP whose identifier no longer resolves to a user) has no
// account to attribute the event to. Found as a real bug during Phase 1
// review: the original invariant only allowed null actorUserId when
// source === 'system', which meant every unknown-identifier login/OTP
// attempt in auth.service.ts (source: 'api') threw here instead of
// producing the intended 401/404 -- confirmed by tracing the actual
// login_failed/otp_request_failed/otp_verify_failed/otp_verified call
// sites in auth.service.ts, not just the reported symptom.
const ANONYMOUS_ACTOR_ACTIONS = new Set<AuditAction>([
  'login_failed',
  'otp_request_failed',
  'otp_verify_failed',
  'otp_verified',
]);

// Serialized `changes` beyond this size is truncated rather than growing
// the table unboundedly for any bulk-ish or unusually large diff.
const MAX_CHANGES_BYTES = 8 * 1024;

export interface AuditParams {
  // null both when no account is resolved at all (unknown-identifier
  // login/OTP attempt) AND when an actor is known but organisation
  // membership was never looked up for this event (User isn't itself
  // organisation-scoped -- membership lives on the separate
  // OrganisationUser join table, and several Auth events legitimately
  // don't need it). Do not infer "organisationId is null" as "actor is
  // unknown" -- check actorUserId directly for that.
  organisationId: string | null;
  branchId?: string | null;
  orgType: OrgType | null;
  entityType: string;
  entityId?: string | null;
  action: AuditAction;
  severity: AuditSeverity;
  // null when source === 'system' (no human actor), OR for the specific
  // "unresolvable identifier" actions in ANONYMOUS_ACTOR_ACTIONS above
  // (an unknown-account login/OTP attempt has no account to attribute to,
  // regardless of source). Any other action with a null actor is a bug,
  // not a legitimate state -- record() throws on it.
  actorUserId: string | null;
  actorRole?: string | null;
  source: AuditSource;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  changes?: Record<string, { from: unknown; to: unknown }> | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * The Audit Contract -- see
 * scope/Audit_Trail_Accountability_Scope_v4.md "Audit Contract". Every
 * module calls record() with this same shape rather than inventing its
 * own audit-writing convention. Runtime invariants below are enforced
 * before any write, not left to caller discipline.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  /**
   * @param manager When provided, the insert runs on this EntityManager's
   * connection/transaction -- used for critical-severity events that must
   * commit atomically with their business write (v4 "Durability policy").
   * Omitted for sensitive/normal events, which are still always awaited,
   * just not inside the caller's transaction -- never fire-and-forget.
   */
  async record(params: AuditParams, manager?: EntityManager): Promise<void> {
    if (
      params.actorUserId === null &&
      params.source !== 'system' &&
      !ANONYMOUS_ACTOR_ACTIONS.has(params.action)
    ) {
      throw new Error(
        `AuditService.record: actorUserId is null but source is '${params.source}' and ` +
        `action '${params.action}' is not in ANONYMOUS_ACTOR_ACTIONS. A null actor is only ` +
        `valid for system/cron-originated events, or for the specific actions that represent ` +
        `an unresolvable identifier (see ANONYMOUS_ACTOR_ACTIONS above).`,
      );
    }

    if (params.severity === 'critical' && !manager) {
      this.logger.warn(
        `AuditService.record: severity 'critical' for ${params.entityType}/${params.action} ` +
        `was called without an EntityManager -- the durability guarantee (same-transaction write) is not met.`,
      );
    }

    if (!KNOWN_ACTIONS.has(params.action)) {
      this.logger.warn(
        `AuditService.record: action '${params.action}' is not in the known taxonomy -- ` +
        `check for a typo (e.g. casing) before this fragments reporting queries.`,
      );
    }

    let changes: Record<string, { from: unknown; to: unknown }> | null = null;
    if (params.changes) {
      const filtered = filterAuditChanges(params.entityType, params.changes);
      if (filtered === null) {
        this.logger.warn(
          `AuditService.record: entityType '${params.entityType}' has no AUDIT_FIELD_POLICY entry -- ` +
          `changes dropped rather than captured unfiltered.`,
        );
      } else {
        changes = filtered;
        const serialized = JSON.stringify(changes);
        if (Buffer.byteLength(serialized, 'utf8') > MAX_CHANGES_BYTES) {
          changes = { _truncated: { from: true, to: true } } as any;
        }
      }
    }

    const repo = manager ? manager.getRepository(AuditLog) : this.auditRepo;
    const entry = repo.create({
      organisationId: params.organisationId,
      branchId: params.branchId ?? null,
      orgType: params.orgType,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      action: params.action,
      severity: params.severity,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole ?? null,
      source: params.source,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      requestId: params.requestId ?? null,
      changes,
      reason: params.reason ?? null,
      metadata: params.metadata ?? null,
    });

    await repo.save(entry);
  }
}
