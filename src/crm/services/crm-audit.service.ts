import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmAuditLog } from '../entities/crm-audit-log.entity';
import type { CrmAuditAction, CrmAuditEntity } from '../enums/crm.enums';
import { AuditService } from '../../audit/audit.service';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import type { OrgType } from '../../audit/audit.types';

/**
 * Phase 2 of scope/Audit_Trail_Accountability_Scope_v4.md — repoints CRM's
 * audit writes at the unified `audit_logs` table while keeping this
 * service's public contract (and every one of its 14 call sites across
 * the 5 CRM services) unchanged in behavior. See
 * scope/Audit_Trail_Phase2_CRM_Migration_Implementation_Plan.md.
 *
 * New writes go to `audit_logs` via `AuditService`. Historical rows stay
 * in `crm_audit_log` (small, already immutable, no backfill needed) --
 * `findForEntity()` reads both and merges them so the one consumer
 * (`GET .../leads/:id/audit`) sees continuous history across the cutover.
 */

/**
 * Only 3 of the 14 CRM audit call sites build a genuine before/after diff
 * (`crm-leads.service.ts`'s `update()` and `assignment()`, and
 * `crm-requirements.service.ts`'s `update()`) -- each as two parallel
 * objects with matching keys, not the `{field: {from, to}}` shape
 * `AuditService` expects. The other 11 have no real "from" state at all:
 * flat creation snapshots, a status-only update, descriptive event facts,
 * or a single note. Forcing all 14 into a diff shape would mean either
 * fabricating a `from` that was never captured, or hiding an entire
 * `before`/`after` blob behind opaque keys the field-policy allowlist
 * can't see inside -- so only genuine diffs go through `changes`
 * (filtered by AUDIT_FIELD_POLICY); everything else passes through to
 * `metadata` exactly as captured today.
 */
export function normalizeCrmChanges(raw: Record<string, any> | null | undefined): {
  changes: Record<string, { from: unknown; to: unknown }> | null;
  metadata: Record<string, unknown> | null;
} {
  if (!raw) return { changes: null, metadata: null };
  if (raw.before && raw.after && typeof raw.before === 'object' && typeof raw.after === 'object') {
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(raw.after)) {
      diff[key] = { from: raw.before[key], to: raw.after[key] };
    }
    return { changes: diff, metadata: null };
  }
  return { changes: null, metadata: raw };
}

@Injectable()
export class CrmAuditService {
  constructor(
    @InjectRepository(CrmAuditLog)
    private readonly legacyAuditRepo: Repository<CrmAuditLog>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly auditService: AuditService,
  ) {}

  async record(params: {
    organisationId: string;
    entityType: CrmAuditEntity;
    entityId: string;
    action: CrmAuditAction;
    actorUserId?: string | null;
    actorRole?: string | null;
    organisationType?: string | null;
    changes?: Record<string, any> | null;
    fromStage?: string | null;
    toStage?: string | null;
  }): Promise<void> {
    const { changes, metadata: changesMetadata } = normalizeCrmChanges(params.changes);
    const stageMetadata = (params.fromStage || params.toStage)
      ? { fromStage: params.fromStage ?? null, toStage: params.toStage ?? null }
      : null;

    await this.auditService.record({
      organisationId: params.organisationId,
      branchId: null, // CRM entities have no branch concept
      orgType: (params.organisationType as OrgType) ?? null,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action === 'delete' ? 'soft_delete' : params.action,
      severity: ['delete', 'export'].includes(params.action) ? 'sensitive' : 'normal',
      actorUserId: params.actorUserId ?? null,
      actorRole: params.actorRole ?? null,
      source: 'api',
      changes,
      // Both can be populated at once -- e.g. a lost-stage stage_change
      // sends both `{lostReason}` (no before/after keys, so it's
      // changesMetadata) and fromStage/toStage (stageMetadata) in the
      // same call. Merge both rather than assume only one is ever set.
      metadata: changesMetadata || stageMetadata
        ? { ...changesMetadata, ...stageMetadata }
        : null,
    });
  }

  /** Read the trail for one entity, newest first (Owner/Admin only at controller). */
  async findForEntity(organisationId: string, entityType: CrmAuditEntity, entityId: string) {
    const [legacy, current] = await Promise.all([
      this.legacyAuditRepo.find({
        where: { organisationId, entityType, entityId },
        order: { createdAt: 'DESC' },
      }),
      this.auditLogRepo.find({
        where: { organisationId, entityType, entityId },
        order: { createdAt: 'DESC' },
      }),
    ]);

    const projected = current.map((row) => {
      const { fromStage, toStage, ...restMetadata } = (row.metadata as any) ?? {};
      const hasRest = Object.keys(restMetadata).length > 0;
      return {
        id: row.id,
        entityType: row.entityType as CrmAuditEntity,
        entityId: row.entityId as string,
        // Project back to the frontend-facing action name -- CrmAuditEntry
        // (Medilink/src/types/crm.ts) has never seen 'soft_delete'.
        action: (row.action === 'soft_delete' ? 'delete' : row.action) as CrmAuditAction,
        actorUserId: row.actorUserId,
        // A real diff lives in `changes`; the other 11 call sites' data
        // lives in `metadata` instead (minus the stage keys, projected
        // separately below) -- see normalizeCrmChanges().
        changes: row.changes ?? (hasRest ? restMetadata : null),
        fromStage: fromStage ?? null,
        toStage: toStage ?? null,
        createdAt: row.createdAt,
      };
    });

    return [...legacy, ...projected].sort(
      (a, b) => +new Date(b.createdAt as any) - +new Date(a.createdAt as any),
    );
  }
}
