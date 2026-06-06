import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, IsNull } from 'typeorm';
import { CrmLead } from '../entities/crm-lead.entity';
import { CrmStaffScope } from '../entities/crm-staff-scope.entity';
import { OrganisationUser } from '../../organisation-users/entities/organisation-user.entity';
import { CrmPipelineService } from './crm-pipeline.service';
import { CrmAuditService } from './crm-audit.service';
import { CreateLeadDto } from '../dto/create-lead.dto';
import { UpdateLeadDto } from '../dto/update-lead.dto';
import { QueryLeadsDto } from '../dto/query-leads.dto';
import { AssignLeadDto } from '../dto/lead-actions.dto';
import {
  CrmActor,
  isCrmManagerTier,
  isCrmTeamLead,
} from '../crm-access.util';
import { UserRole } from '../../users/enums/user-role.enum';
import { NotificationsService } from '../../notifications/notifications.service';

/** Per-role stage caps (B1). Manager/Admin uncapped. */
const TELECALLER_CAP_KEY = 'demo_scheduled';
const FIELD_CAP_KEY = 'negotiation';

@Injectable()
export class CrmLeadsService {
  constructor(
    @InjectRepository(CrmLead)
    private readonly leadRepo: Repository<CrmLead>,
    @InjectRepository(OrganisationUser)
    private readonly orgUserRepo: Repository<OrganisationUser>,
    @InjectRepository(CrmStaffScope)
    private readonly scopeRepo: Repository<CrmStaffScope>,
    private readonly pipeline: CrmPipelineService,
    private readonly audit: CrmAuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // --------------------------------------------------------------------------
  // Per-staff data scope (territory). Restricts visible leads by state /
  // district / stage / centre type / priority on top of role isolation.
  // SUPER_ADMIN is exempt (always a full-view safety valve).
  // --------------------------------------------------------------------------
  private async getActorScope(organisationId: string, actor: CrmActor): Promise<CrmStaffScope | null> {
    if ((actor.role || '').toUpperCase() === UserRole.SUPER_ADMIN) return null;
    return this.scopeRepo.findOne({ where: { organisationId, userId: actor.userId } });
  }

  private applyScope(qb: any, scope: CrmStaffScope | null): void {
    if (!scope) return;
    const dim = (col: string, vals?: string[] | null, key?: string) => {
      if (vals && vals.length > 0) qb.andWhere(`lead.${col} IN (:...${key})`, { [key!]: vals });
    };
    dim('state', scope.states, 'scState');
    dim('district', scope.districts, 'scDistrict');
    dim('stage', scope.stages, 'scStage');
    dim('centre_type', scope.centreTypes, 'scCentreType');
    dim('priority', scope.priorities, 'scPriority');
  }

  private leadMatchesScope(lead: CrmLead, scope: CrmStaffScope | null): boolean {
    if (!scope) return true;
    const ok = (vals: string[] | null | undefined, value: string | null) =>
      !vals || vals.length === 0 || (value != null && vals.includes(value));
    return (
      ok(scope.states, lead.state) &&
      ok(scope.districts, lead.district) &&
      ok(scope.stages, lead.stage) &&
      ok(scope.centreTypes, lead.centreType) &&
      ok(scope.priorities, lead.priority)
    );
  }

  // --------------------------------------------------------------------------
  // Row-level isolation (A5, B1): frontline staff only ever touch leads
  // assigned to them. Applied to EVERY read/write path.
  // --------------------------------------------------------------------------
  private appliesOwnAssignmentFilter(actor: CrmActor): boolean {
    // Managers/Admins see everything; everyone else is scoped to assignments.
    return !isCrmManagerTier(actor.role);
  }

  private assertCanAccess(lead: CrmLead, actor: CrmActor): void {
    if (isCrmManagerTier(actor.role)) return;
    const mine =
      lead.assignedTelecallerId === actor.userId ||
      lead.assignedFieldStaffId === actor.userId;
    if (!mine) {
      // Don't leak existence — behave as if it isn't there.
      throw new NotFoundException('Lead not found');
    }
  }

  // --------------------------------------------------------------------------
  // List with filters + pagination
  // --------------------------------------------------------------------------
  async findAll(organisationId: string, actor: CrmActor, q: QueryLeadsDto) {
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 20, 100);

    const qb = this.leadRepo
      .createQueryBuilder('lead')
      .where('lead.organisation_id = :organisationId', { organisationId })
      .andWhere('lead.deleted_at IS NULL');

    // Isolation: frontline (or any non-manager) is locked to their own leads.
    // Managers may also opt into scope=mine.
    const forceMine = this.appliesOwnAssignmentFilter(actor);
    if (forceMine || q.scope === 'mine') {
      qb.andWhere(
        new Brackets((w) => {
          w.where('lead.assigned_telecaller_id = :uid', { uid: actor.userId })
            .orWhere('lead.assigned_field_staff_id = :uid', { uid: actor.userId });
        }),
      );
    }

    if (q.stage) qb.andWhere('lead.stage = :stage', { stage: q.stage });
    if (q.priority) qb.andWhere('lead.priority = :priority', { priority: q.priority });
    if (q.centreType) qb.andWhere('lead.centre_type = :ct', { ct: q.centreType });
    if (q.state) qb.andWhere('lead.state ILIKE :state', { state: q.state });
    if (q.district) qb.andWhere('lead.district ILIKE :district', { district: `%${q.district}%` });
    if (q.isIncomplete === 'true') qb.andWhere('lead.is_incomplete = true');
    if (q.isIncomplete === 'false') qb.andWhere('lead.is_incomplete = false');

    if (q.search) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('lead.name ILIKE :s', { s: `%${q.search}%` })
            .orWhere('lead.phone ILIKE :s', { s: `%${q.search}%` })
            .orWhere('lead.city ILIKE :s', { s: `%${q.search}%` });
        }),
      );
    }

    // Follow-up pins (B4)
    if (q.followUp === 'today') {
      qb.andWhere('lead.next_follow_up_at::date = CURRENT_DATE');
    } else if (q.followUp === 'overdue') {
      qb.andWhere('lead.next_follow_up_at < NOW()');
    } else if (q.followUp === 'upcoming') {
      qb.andWhere('lead.next_follow_up_at > NOW()');
    }

    // Per-staff territory scope on top of everything else.
    this.applyScope(qb, await this.getActorScope(organisationId, actor));

    qb.orderBy('lead.next_follow_up_at', 'ASC', 'NULLS LAST')
      .addOrderBy('lead.updated_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // --------------------------------------------------------------------------
  // Filter facets — distinct states and districts (with counts) for the filter
  // UI. Honours the same assignment scope as the list.
  // --------------------------------------------------------------------------
  async facets(organisationId: string, actor: CrmActor, state?: string) {
    const scope = await this.getActorScope(organisationId, actor);
    const scoped = (alias: string) => {
      const qb = this.leadRepo
        .createQueryBuilder('lead')
        .where('lead.organisation_id = :organisationId', { organisationId })
        .andWhere('lead.deleted_at IS NULL');
      if (this.appliesOwnAssignmentFilter(actor)) {
        qb.andWhere(
          new Brackets((w) => {
            w.where('lead.assigned_telecaller_id = :uid', { uid: actor.userId })
              .orWhere('lead.assigned_field_staff_id = :uid', { uid: actor.userId });
          }),
        );
      }
      this.applyScope(qb, scope);
      return qb.select(`NULLIF(TRIM(lead.${alias}), '')`, 'value').addSelect('COUNT(*)', 'count');
    };

    const states = await scoped('state')
      .andWhere("NULLIF(TRIM(lead.state), '') IS NOT NULL")
      .groupBy('value')
      .orderBy('count', 'DESC')
      .limit(20)
      .getRawMany();

    const districtQb = scoped('district').andWhere("NULLIF(TRIM(lead.district), '') IS NOT NULL");
    if (state) districtQb.andWhere('lead.state ILIKE :state', { state });
    const districts = await districtQb
      .groupBy('value')
      .orderBy('count', 'DESC')
      .limit(60)
      .getRawMany();

    return {
      states: states.map((s) => ({ value: s.value, count: parseInt(s.count, 10) })),
      districts: districts.map((d) => ({ value: d.value, count: parseInt(d.count, 10) })),
    };
  }

  // --------------------------------------------------------------------------
  // Single lead (isolation enforced)
  // --------------------------------------------------------------------------
  async findOne(organisationId: string, id: string, actor: CrmActor): Promise<CrmLead> {
    const lead = await this.leadRepo.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    this.assertCanAccess(lead, actor);
    // Territory scope: can't open a lead outside the staff's allowed scope.
    const scope = await this.getActorScope(organisationId, actor);
    if (!this.leadMatchesScope(lead, scope)) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  // --------------------------------------------------------------------------
  // Duplicate detection (B8)
  // --------------------------------------------------------------------------
  private normalisePhone(phone?: string | null): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits || null;
  }

  async findDuplicates(organisationId: string, dto: { phone?: string; googlePlaceId?: string; name?: string }) {
    const phone = this.normalisePhone(dto.phone);
    const qb = this.leadRepo
      .createQueryBuilder('lead')
      .where('lead.organisation_id = :organisationId', { organisationId })
      .andWhere('lead.deleted_at IS NULL');

    qb.andWhere(
      new Brackets((w) => {
        let added = false;
        if (dto.googlePlaceId) {
          w.orWhere('lead.google_place_id = :pid', { pid: dto.googlePlaceId });
          added = true;
        }
        if (phone) {
          w.orWhere("regexp_replace(COALESCE(lead.phone,''), '\\D', '', 'g') LIKE :ph", { ph: `%${phone}` });
          added = true;
        }
        if (dto.name) {
          w.orWhere('lead.name ILIKE :nm', { nm: dto.name.trim() });
          added = true;
        }
        if (!added) w.where('1 = 0'); // nothing to match on
      }),
    );
    return qb.getMany();
  }

  // --------------------------------------------------------------------------
  // Create (with dedupe warning; no-phone => flagged incomplete) (B8)
  // --------------------------------------------------------------------------
  async create(organisationId: string, dto: CreateLeadDto, actor: CrmActor): Promise<CrmLead> {
    if (dto.phone || dto.googlePlaceId || dto.name) {
      const dupes = await this.findDuplicates(organisationId, {
        phone: dto.phone,
        googlePlaceId: dto.googlePlaceId,
        name: dto.name,
      });
      if (dupes.length > 0 && !dto.force) {
        throw new ConflictException({
          message: 'Possible duplicate centre. Resend with force=true to create anyway.',
          duplicates: dupes.map((d) => ({
            id: d.id,
            name: d.name,
            phone: d.phone,
            stage: d.stage,
            alreadyOnboarded: !!d.onboardedOrganisationId || d.stage === 'onboarded',
          })),
        });
      }
    }

    // Only managers may set assignment at create time.
    const manager = isCrmManagerTier(actor.role);
    const telecallerId = manager ? dto.assignedTelecallerId ?? null : null;
    const fieldStaffId = manager ? dto.assignedFieldStaffId ?? null : null;
    if (telecallerId) await this.assertActiveMember(organisationId, telecallerId);
    if (fieldStaffId) await this.assertActiveMember(organisationId, fieldStaffId);

    const { force, ...rest } = dto;
    const lead = this.leadRepo.create({
      ...rest,
      organisationId,
      stage: 'new',
      priority: dto.priority ?? 'warm',
      isIncomplete: !dto.phone,
      assignedTelecallerId: telecallerId,
      assignedFieldStaffId: fieldStaffId,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });
    const saved = await this.leadRepo.save(lead);

    await this.audit.record({
      organisationId,
      entityType: 'lead',
      entityId: saved.id,
      action: 'create',
      actorUserId: actor.userId,
      changes: { name: saved.name, source: saved.leadSource },
    });
    return saved;
  }

  // --------------------------------------------------------------------------
  // Update profile fields (audited; isolation enforced)
  // --------------------------------------------------------------------------
  async update(organisationId: string, id: string, dto: UpdateLeadDto, actor: CrmActor): Promise<CrmLead> {
    const lead = await this.findOne(organisationId, id, actor);

    const before: Record<string, any> = {};
    const after: Record<string, any> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value === undefined) continue;
      if ((lead as any)[key] !== value) {
        before[key] = (lead as any)[key];
        after[key] = value;
        (lead as any)[key] = value;
      }
    }
    if (dto.phone !== undefined) lead.isIncomplete = !dto.phone;
    lead.updatedBy = actor.userId;

    const saved = await this.leadRepo.save(lead);
    if (Object.keys(after).length > 0) {
      await this.audit.record({
        organisationId,
        entityType: 'lead',
        entityId: id,
        action: 'update',
        actorUserId: actor.userId,
        changes: { before, after },
      });
    }
    return saved;
  }

  // --------------------------------------------------------------------------
  // Assign / reassign (B1). Managers: any lead. Team leads: only leads they
  // currently hold (full team scoping deferred — see README).
  // --------------------------------------------------------------------------
  async assign(organisationId: string, id: string, dto: AssignLeadDto, actor: CrmActor): Promise<CrmLead> {
    const lead = await this.leadRepo.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const manager = isCrmManagerTier(actor.role);
    if (!manager) {
      if (!isCrmTeamLead(actor.role)) {
        throw new ForbiddenException('You cannot reassign leads');
      }
      const holdsLead =
        lead.assignedTelecallerId === actor.userId ||
        lead.assignedFieldStaffId === actor.userId;
      if (!holdsLead) {
        throw new ForbiddenException('Team leads can only reassign leads they are on');
      }
    }

    const before = {
      telecaller: lead.assignedTelecallerId,
      field: lead.assignedFieldStaffId,
    };

    if (dto.telecallerId !== undefined) {
      if (dto.telecallerId) await this.assertActiveMember(organisationId, dto.telecallerId);
      lead.assignedTelecallerId = dto.telecallerId || null;
    }
    if (dto.fieldStaffId !== undefined) {
      if (dto.fieldStaffId) await this.assertActiveMember(organisationId, dto.fieldStaffId);
      lead.assignedFieldStaffId = dto.fieldStaffId || null;
    }
    lead.updatedBy = actor.userId;

    const saved = await this.leadRepo.save(lead);
    await this.audit.record({
      organisationId,
      entityType: 'lead',
      entityId: id,
      action: 'assignment',
      actorUserId: actor.userId,
      changes: {
        before,
        after: { telecaller: saved.assignedTelecallerId, field: saved.assignedFieldStaffId },
      },
    });

    // Phase 18L: Notify staff on assignment
    const toNotify: string[] = [];
    if (dto.telecallerId && saved.assignedTelecallerId !== before.telecaller) {
      toNotify.push(saved.assignedTelecallerId!);
    }
    if (dto.fieldStaffId && saved.assignedFieldStaffId !== before.field) {
      toNotify.push(saved.assignedFieldStaffId!);
    }

    if (toNotify.length > 0) {
      this.notifications.sendToUsers({
        userIds: toNotify,
        title: 'Lead Assigned',
        body: `You have been assigned to lead: ${saved.name}`,
        data: { leadId: saved.id, type: 'crm_lead_assigned' },
      }).catch(() => {});
    }

    return saved;
  }

  // --------------------------------------------------------------------------
  // Stage change with per-role caps (B1, B2). Won/Lost: manager only.
  // Lost requires a reason. Returns the lead; notification hooks added in the
  // notifications step.
  // --------------------------------------------------------------------------
  async changeStage(
    organisationId: string,
    id: string,
    stageKey: string,
    actor: CrmActor,
    lostReason?: string,
  ): Promise<CrmLead> {
    const lead = await this.findOne(organisationId, id, actor);
    const stageMap = await this.pipeline.getStageMap(organisationId);
    const target = stageMap.get(stageKey);
    if (!target) throw new BadRequestException(`Unknown pipeline stage: ${stageKey}`);

    const manager = isCrmManagerTier(actor.role);

    if (target.isWon || target.isLost) {
      if (!manager) {
        throw new ForbiddenException('Only a manager can mark a lead Won or Lost');
      }
      if (target.isLost && !lostReason) {
        throw new BadRequestException('A reason is required to mark a lead as Lost');
      }
    } else if (!target.isSideState && !manager) {
      // Normal forward pipeline stage — enforce the role cap.
      const role = (actor.role || '').toUpperCase();
      const capKey =
        role === UserRole.FIELD_STAFF || role === UserRole.TEAM_LEAD
          ? FIELD_CAP_KEY
          : TELECALLER_CAP_KEY;
      const cap = stageMap.get(capKey)?.sortOrder ?? Number.POSITIVE_INFINITY;
      if (target.sortOrder > cap) {
        throw new ForbiddenException(
          `Your role can advance leads only up to "${capKey}"`,
        );
      }
    }

    const fromStage = lead.stage;
    if (fromStage === stageKey) return lead; // no-op

    lead.stage = stageKey;
    if (target.isLost) lead.lostReason = lostReason ?? null;
    lead.updatedBy = actor.userId;
    const saved = await this.leadRepo.save(lead);

    await this.audit.record({
      organisationId,
      entityType: 'lead',
      entityId: id,
      action: 'stage_change',
      actorUserId: actor.userId,
      fromStage,
      toStage: stageKey,
      changes: target.isLost ? { lostReason } : null,
    });
    return saved;
  }

  // --------------------------------------------------------------------------
  // Soft delete (manager/admin via controller guard). Never hard-deleted.
  // --------------------------------------------------------------------------
  async softDelete(organisationId: string, id: string, actor: CrmActor): Promise<void> {
    const lead = await this.leadRepo.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    await this.leadRepo.softDelete(id);
    await this.audit.record({
      organisationId,
      entityType: 'lead',
      entityId: id,
      action: 'delete',
      actorUserId: actor.userId,
    });
  }

  // --------------------------------------------------------------------------
  // DPDP Anonymise (Phase 18P). Retains the lead for analytics but strips PII.
  // --------------------------------------------------------------------------
  async anonymiseLead(organisationId: string, id: string, actor: CrmActor): Promise<CrmLead> {
    const lead = await this.leadRepo.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const anonymisedStr = '[ANONYMISED]';
    
    // Strip PII
    lead.name = anonymisedStr;
    if (lead.address) lead.address = anonymisedStr;
    if (lead.primaryContactName) lead.primaryContactName = anonymisedStr;
    if (lead.phone) lead.phone = anonymisedStr;
    if (lead.phoneSecondary) lead.phoneSecondary = null;
    if (lead.whatsapp) lead.whatsapp = null;
    if (lead.email) lead.email = anonymisedStr;
    if (lead.ownerDoctorName) lead.ownerDoctorName = anonymisedStr;
    if (lead.googleMapsUrl) lead.googleMapsUrl = null;
    if (lead.website) lead.website = null;
    if (lead.googlePlaceId) lead.googlePlaceId = null;

    lead.updatedBy = actor.userId;

    const saved = await this.leadRepo.save(lead);

    await this.audit.record({
      organisationId,
      entityType: 'lead',
      entityId: id,
      action: 'update', // We'll log it as update since 'anonymise' might not be in the enum, or we can just pass 'update'
      actorUserId: actor.userId,
      changes: { info: 'PII removed for DPDP compliance' },
    });

    return saved;
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------
  private async assertActiveMember(organisationId: string, userId: string): Promise<void> {
    const member = await this.orgUserRepo.findOne({
      where: { organisationId, userId, isActive: true },
    });
    if (!member) {
      throw new BadRequestException('Assignee is not an active member of this organisation');
    }
  }
}
