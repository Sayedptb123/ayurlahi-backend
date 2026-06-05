import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { CrmTask } from '../entities/crm-task.entity';
import { OrganisationUser } from '../../organisation-users/entities/organisation-user.entity';
import { CrmLeadsService } from './crm-leads.service';
import { CrmAuditService } from './crm-audit.service';
import { CreateTaskDto, UpdateTaskDto, QueryTasksDto } from '../dto/task.dto';
import { CrmActor, isCrmManagerTier } from '../crm-access.util';
import { CrmTaskStatus } from '../enums/crm.enums';

@Injectable()
export class CrmTasksService {
  constructor(
    @InjectRepository(CrmTask)
    private readonly taskRepo: Repository<CrmTask>,
    @InjectRepository(OrganisationUser)
    private readonly orgUserRepo: Repository<OrganisationUser>,
    private readonly leadsService: CrmLeadsService,
    private readonly audit: CrmAuditService,
  ) {}

  /** "My Tasks" with today / overdue / upcoming pins (B6). */
  async listMine(organisationId: string, actor: CrmActor, q: QueryTasksDto) {
    const qb = this.taskRepo
      .createQueryBuilder('task')
      .where('task.organisation_id = :organisationId', { organisationId })
      .andWhere('task.deleted_at IS NULL')
      .andWhere('task.assignee_user_id = :uid', { uid: actor.userId });

    if (q.status) qb.andWhere('task.status = :status', { status: q.status });

    if (q.scope === 'today') {
      qb.andWhere('task.due_at::date = CURRENT_DATE').andWhere("task.status = 'pending'");
    } else if (q.scope === 'overdue') {
      qb.andWhere('task.due_at < NOW()').andWhere("task.status = 'pending'");
    } else if (q.scope === 'upcoming') {
      qb.andWhere('task.due_at > NOW()').andWhere("task.status = 'pending'");
    }

    return qb.orderBy('task.due_at', 'ASC').getMany();
  }

  async listForLead(organisationId: string, leadId: string, actor: CrmActor) {
    await this.leadsService.findOne(organisationId, leadId, actor); // isolation
    return this.taskRepo.find({
      where: { organisationId, leadId },
      order: { dueAt: 'ASC' },
    });
  }

  async create(
    organisationId: string,
    leadId: string,
    dto: CreateTaskDto,
    actor: CrmActor,
  ): Promise<CrmTask> {
    await this.leadsService.findOne(organisationId, leadId, actor); // isolation

    const dueAt = new Date(dto.dueAt);
    if (dueAt.getTime() < Date.now()) {
      throw new BadRequestException('Task due date cannot be in the past');
    }

    // Non-managers may only assign tasks to themselves.
    let assigneeUserId = actor.userId;
    if (dto.assigneeUserId && dto.assigneeUserId !== actor.userId) {
      if (!isCrmManagerTier(actor.role)) {
        throw new ForbiddenException('You can only assign tasks to yourself');
      }
      await this.assertActiveMember(organisationId, dto.assigneeUserId);
      assigneeUserId = dto.assigneeUserId;
    }

    const task = this.taskRepo.create({
      organisationId,
      leadId,
      assigneeUserId,
      title: dto.title,
      description: dto.description ?? null,
      taskType: dto.taskType ?? null,
      dueAt,
      reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : dueAt,
      status: 'pending',
      isRecurring: dto.isRecurring ?? false,
      recurrence: dto.recurrence ?? null,
      createdBy: actor.userId,
    });
    const saved = await this.taskRepo.save(task);
    await this.audit.record({
      organisationId,
      entityType: 'task',
      entityId: saved.id,
      action: 'create',
      actorUserId: actor.userId,
    });
    return saved;
  }

  async update(
    organisationId: string,
    id: string,
    dto: UpdateTaskDto,
    actor: CrmActor,
  ): Promise<CrmTask> {
    const task = await this.getOwnedOrManaged(organisationId, id, actor);

    if (dto.dueAt !== undefined) {
      const d = new Date(dto.dueAt);
      if (d.getTime() < Date.now() && dto.status !== 'done') {
        throw new BadRequestException('Task due date cannot be in the past');
      }
      task.dueAt = d;
    }
    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.taskType !== undefined) task.taskType = dto.taskType;
    if (dto.reminderAt !== undefined) task.reminderAt = new Date(dto.reminderAt);
    if (dto.status !== undefined) {
      task.status = dto.status as CrmTaskStatus;
      task.completedAt = dto.status === 'done' ? new Date() : null;
    }

    const saved = await this.taskRepo.save(task);
    await this.audit.record({
      organisationId,
      entityType: 'task',
      entityId: id,
      action: 'update',
      actorUserId: actor.userId,
      changes: { status: saved.status },
    });
    return saved;
  }

  async complete(organisationId: string, id: string, actor: CrmActor): Promise<CrmTask> {
    return this.update(organisationId, id, { status: 'done' }, actor);
  }

  // --------------------------------------------------------------------------
  private async getOwnedOrManaged(
    organisationId: string,
    id: string,
    actor: CrmActor,
  ): Promise<CrmTask> {
    const task = await this.taskRepo.findOne({ where: { id, organisationId } });
    if (!task) throw new NotFoundException('Task not found');
    if (!isCrmManagerTier(actor.role) && task.assigneeUserId !== actor.userId) {
      throw new NotFoundException('Task not found'); // no existence leak
    }
    return task;
  }

  private async assertActiveMember(organisationId: string, userId: string): Promise<void> {
    const member = await this.orgUserRepo.findOne({
      where: { organisationId, userId, isActive: true },
    });
    if (!member) {
      throw new BadRequestException('Assignee is not an active member of this organisation');
    }
  }
}
