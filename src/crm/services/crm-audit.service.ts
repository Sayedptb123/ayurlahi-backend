import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmAuditLog } from '../entities/crm-audit-log.entity';
import { CrmAuditAction, CrmAuditEntity } from '../enums/crm.enums';

/**
 * Append-only audit trail (B7). Every create/update/delete/stage-change/
 * assignment/export goes through here. Rows are never updated or deleted;
 * when a record is edited the previous values are kept in `changes`.
 */
@Injectable()
export class CrmAuditService {
  constructor(
    @InjectRepository(CrmAuditLog)
    private readonly auditRepo: Repository<CrmAuditLog>,
  ) {}

  async record(params: {
    organisationId: string;
    entityType: CrmAuditEntity;
    entityId: string;
    action: CrmAuditAction;
    actorUserId?: string | null;
    changes?: Record<string, any> | null;
    fromStage?: string | null;
    toStage?: string | null;
  }): Promise<void> {
    const entry = this.auditRepo.create({
      organisationId: params.organisationId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      actorUserId: params.actorUserId ?? null,
      changes: params.changes ?? null,
      fromStage: params.fromStage ?? null,
      toStage: params.toStage ?? null,
    });
    await this.auditRepo.save(entry);
  }

  /** Read the trail for one entity, newest first (Owner/Admin only at controller). */
  findForEntity(organisationId: string, entityType: CrmAuditEntity, entityId: string) {
    return this.auditRepo.find({
      where: { organisationId, entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }
}
