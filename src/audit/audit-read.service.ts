import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { resolveDateWindow } from './resolve-date-window';
import { User } from '../users/entities/user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { Branch } from '../branches/entities/branch.entity';

export interface AuditLogDetailResult extends AuditLog {
  actorName: string | null;
  actorEmail: string | null;
  organisationName: string | null;
  branchName: string | null;
}

/**
 * Read side of the audit trail. Kept separate from AuditService, which is
 * write-only by its own docstring -- see
 * scope/Audit_Trail_ReadAPI_AdminUI_Implementation_Plan.md.
 */
@Injectable()
export class AuditReadService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Organisation)
    private readonly organisationRepo: Repository<Organisation>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
  ) {}

  async findAll(query: QueryAuditLogsDto) {
    const { createdAfter, createdBefore } = resolveDateWindow(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.auditRepo
      .createQueryBuilder('audit')
      .select([
        'audit.id',
        'audit.createdAt',
        'audit.action',
        'audit.severity',
        'audit.entityType',
        'audit.entityId',
        'audit.actorUserId',
        'audit.actorRole',
        'audit.organisationId',
        'audit.branchId',
        'audit.source',
        // Deliberately NOT selected: changes, metadata, reason, ipAddress,
        // userAgent, requestId -- decision F. This keeps changes/metadata
        // out of Postgres's result set entirely for a list query, not
        // just out of the API response.
      ])
      .where('audit.createdAt >= :createdAfter', { createdAfter })
      .andWhere('audit.createdAt < :createdBefore', { createdBefore });

    if (query.organisationId) {
      qb.andWhere('audit.organisationId = :organisationId', {
        organisationId: query.organisationId,
      });
    }
    if (query.branchId) {
      qb.andWhere('audit.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.actorUserId) {
      qb.andWhere('audit.actorUserId = :actorUserId', {
        actorUserId: query.actorUserId,
      });
    }
    if (query.action) {
      qb.andWhere('audit.action = :action', { action: query.action });
    }
    if (query.severity) {
      qb.andWhere('audit.severity = :severity', { severity: query.severity });
    }
    if (query.entityType) {
      qb.andWhere('audit.entityType = :entityType', {
        entityType: query.entityType,
      });
    }
    if (query.entityId) {
      qb.andWhere('audit.entityId = :entityId', { entityId: query.entityId });
    }

    qb.orderBy('audit.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * createdAt is required and constrains the query -- the caller already
   * has the value from the list response. Constraining on createdAt is
   * not an optimization here, it's correctness: AuditLog's TypeORM entity
   * models only `id` as its primary key, but Postgres's actual primary
   * key is the composite (id, created_at) because the table is
   * partitioned by created_at. A bare findOne({ where: { id } }) would
   * search every partition and is also the kind of mismatch that looks
   * correct against a mocked repository and misbehaves against real
   * Postgres -- exactly what happened in the incident fixed by b76949f.
   * Do not simplify this back to an id-only lookup.
   *
   * Not an exact `=` match, deliberately: `created_at` has no explicit
   * `precision` on @CreateDateColumn, so Postgres stores it at its
   * default microsecond precision (verified against a real row:
   * 2026-09-22 20:10:58.694447+00). A JS Date -- and therefore the
   * millisecond-precision ISO string the list endpoint serializes and the
   * client sends back -- cannot represent the trailing "447". An exact
   * match against that truncated value never matches the real row. Found
   * during the real-app-boot verification pass (test #13), not by any
   * mocked test. Fixed with a 1ms-wide bounded range instead of a
   * timestamp-truncating function on the column, so partition pruning is
   * unaffected -- still a plain range comparison on the raw column, and
   * `id` (a UUID) makes the match unambiguous regardless of range width.
   */
  async findOne(id: string, createdAt: string): Promise<AuditLogDetailResult> {
    const createdAtMs = new Date(createdAt);
    const row = await this.auditRepo.findOne({
      where: {
        id,
        createdAt: Between(createdAtMs, new Date(createdAtMs.getTime() + 1)),
      },
    });
    if (!row) {
      throw new NotFoundException('Audit log entry not found');
    }

    // Best-effort name resolution for the detail view -- raw UUIDs aren't
    // readable in the admin UI. Not joined into the main query: these FKs
    // aren't enforced (an audit row must survive its referenced user/org/
    // branch being deleted later), so a LEFT JOIN would silently vary
    // between "never existed" and "existed, now gone" with no way to tell
    // them apart in the response. Three narrow, indexed-PK lookups instead,
    // only for whichever ids are actually present on this row.
    const [actor, organisation, branch] = await Promise.all([
      row.actorUserId
        ? this.userRepo.findOne({
            where: { id: row.actorUserId },
            select: ['id', 'firstName', 'lastName', 'email'],
          })
        : null,
      row.organisationId
        ? this.organisationRepo.findOne({
            where: { id: row.organisationId },
            select: ['id', 'name'],
          })
        : null,
      row.branchId
        ? this.branchRepo.findOne({
            where: { id: row.branchId },
            select: ['id', 'name'],
          })
        : null,
    ]);

    return {
      ...row,
      actorName: actor ? `${actor.firstName} ${actor.lastName}`.trim() : null,
      actorEmail: actor?.email ?? null,
      organisationName: organisation?.name ?? null,
      branchName: branch?.name ?? null,
    };
  }
}
