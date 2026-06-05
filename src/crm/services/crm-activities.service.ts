import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmActivity } from '../entities/crm-activity.entity';
import { CrmLead } from '../entities/crm-lead.entity';
import { CrmTask } from '../entities/crm-task.entity';
import { CrmLeadsService } from './crm-leads.service';
import { CrmAuditService } from './crm-audit.service';
import { CreateActivityDto } from '../dto/create-activity.dto';
import { CrmActor } from '../crm-access.util';
import { CrmActivityType } from '../enums/crm.enums';

const CONTACT_TYPES = ['call', 'whatsapp', 'visit', 'email'];

@Injectable()
export class CrmActivitiesService {
  constructor(
    @InjectRepository(CrmActivity)
    private readonly activityRepo: Repository<CrmActivity>,
    @InjectRepository(CrmLead)
    private readonly leadRepo: Repository<CrmLead>,
    @InjectRepository(CrmTask)
    private readonly taskRepo: Repository<CrmTask>,
    private readonly leadsService: CrmLeadsService,
    private readonly audit: CrmAuditService,
  ) {}

  /** Timeline for a lead (newest first). Access enforced via leadsService. */
  async listForLead(organisationId: string, leadId: string, actor: CrmActor) {
    await this.leadsService.findOne(organisationId, leadId, actor); // isolation
    return this.activityRepo.find({
      where: { organisationId, leadId },
      order: { occurredAt: 'DESC' },
    });
  }

  /** Log a touch (call/whatsapp/visit/email/note). Calls require a disposition. */
  async create(
    organisationId: string,
    leadId: string,
    dto: CreateActivityDto,
    actor: CrmActor,
  ): Promise<CrmActivity> {
    const lead = await this.leadsService.findOne(organisationId, leadId, actor); // isolation

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();

    let dueDate: Date | null = null;
    if (dto.nextActionDueAt) {
      dueDate = new Date(dto.nextActionDueAt);
      if (dueDate.getTime() < Date.now()) {
        throw new BadRequestException('Next follow-up cannot be in the past');
      }
    }

    const activity = this.activityRepo.create({
      organisationId,
      leadId,
      type: dto.type as CrmActivityType,
      disposition: dto.disposition ?? null,
      notes: dto.notes ?? null,
      occurredAt,
      durationSeconds: dto.durationSeconds ?? null,
      staffUserId: actor.userId,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      attachments: dto.attachments ?? null,
      nextAction: dto.nextAction ?? null,
      nextActionDueAt: dueDate,
      callLogVerified: dto.callLogVerified ?? false,
      whatsappTemplate: dto.whatsappTemplate ?? null,
      createdOffline: dto.createdOffline ?? false,
      syncedAt: dto.createdOffline ? new Date() : null,
    });
    const saved = await this.activityRepo.save(activity);

    // Update the lead's contact/follow-up markers.
    const patch: Partial<CrmLead> = {};
    if (CONTACT_TYPES.includes(dto.type)) patch.lastContactedAt = occurredAt;
    if (dueDate) patch.nextFollowUpAt = dueDate;
    if (Object.keys(patch).length > 0) {
      await this.leadRepo.update({ id: leadId, organisationId }, patch);
    }

    // A scheduled next action becomes a follow-up task with a reminder (B6).
    if (dueDate) {
      const task = this.taskRepo.create({
        organisationId,
        leadId,
        assigneeUserId: actor.userId,
        title: dto.nextAction || `Follow up: ${lead.name}`,
        taskType: dto.type === 'visit' ? 'visit' : 'call_back',
        dueAt: dueDate,
        reminderAt: dueDate,
        status: 'pending',
        createdBy: actor.userId,
      });
      await this.taskRepo.save(task);
    }

    await this.audit.record({
      organisationId,
      entityType: 'activity',
      entityId: saved.id,
      action: 'create',
      actorUserId: actor.userId,
      changes: { type: saved.type, disposition: saved.disposition },
    });

    return saved;
  }
}
