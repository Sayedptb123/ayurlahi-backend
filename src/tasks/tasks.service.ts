import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { StaffTask } from './entities/staff-task.entity';
import { Staff } from '../staff/entities/staff.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(StaffTask)
    private readonly tasksRepository: Repository<StaffTask>,
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    @InjectRepository(OrganisationUser)
    private readonly orgUserRepo: Repository<OrganisationUser>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    organisationId: string,
    createDto: CreateTaskDto,
    assignedBy: string,
  ): Promise<StaffTask> {
    let assignedToUserId: string | null = createDto.assignedToUserId ?? null;

    if (createDto.assignedToStaffId && !assignedToUserId) {
      const staff = await this.staffRepository.findOne({
        where: { id: createDto.assignedToStaffId, organisationId },
      });
      if (!staff) {
        throw new NotFoundException('Staff member not found');
      }
      assignedToUserId = staff.userId ?? null;
    }

    const task = this.tasksRepository.create();
    task.organisationId = organisationId;
    task.title = createDto.title;
    task.description = createDto.description ?? null;
    task.category = (createDto.category ?? 'general') as any;
    task.assignedToStaffId = createDto.assignedToStaffId ?? null;
    task.assignedToDoctorId = createDto.assignedToDoctorId ?? null;
    task.assignedToUserId = assignedToUserId;
    task.assignedBy = assignedBy;
    task.dueDate = createDto.dueDate ?? null;
    task.dueTime = createDto.dueTime ?? null;
    task.priority = (createDto.priority ?? 'medium') as any;
    task.status = 'pending';
    task.notes = createDto.notes ?? null;

    const saved = await this.tasksRepository.save(task);
    if (assignedToUserId) {
      this.notificationsService
        .sendToUsers({
          userIds: [assignedToUserId],
          title: 'New Task Assigned',
          body: saved.title,
          data: { taskId: saved.id, type: 'task_assigned' },
        })
        .catch(() => {});
    } else {
      this.orgUserRepo
        .find({
          where: {
            organisationId,
            role: In(['MANAGER', 'OWNER', 'ADMIN']),
            isActive: true,
          },
        })
        .then((managers) => {
          const toNotify = managers
            .map((m) => m.userId)
            .filter((id) => id && id !== assignedBy);
          if (toNotify.length > 0) {
            this.notificationsService
              .sendToUsers({
                userIds: toNotify as string[],
                title: 'New Service Request',
                body: saved.title,
                data: { taskId: saved.id, type: 'task_request' },
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    }

    return saved;
  }

  async findAll(
    organisationId: string,
    query: {
      page?: number;
      limit?: number;
      status?: string;
      assignedToStaffId?: string;
      assignedToUserId?: string;
      assignedBy?: string;
    },
  ): Promise<{ data: StaffTask[]; total: number }> {
    const {
      page = 1,
      limit = 20,
      status,
      assignedToStaffId,
      assignedToUserId,
      assignedBy,
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.tasksRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedToStaff', 'staff')
      .leftJoinAndSelect('task.assignedToUser', 'assignedToUser')
      .leftJoinAndSelect('task.assignedByUser', 'assignedByUser')
      .where('task.organisationId = :organisationId', { organisationId })
      .andWhere('task.deletedAt IS NULL');

    if (status) {
      qb.andWhere('task.status = :status', { status });
    }
    if (assignedToStaffId) {
      qb.andWhere('task.assignedToStaffId = :assignedToStaffId', {
        assignedToStaffId,
      });
    }
    if (assignedToUserId && assignedBy && assignedToUserId === assignedBy) {
      qb.andWhere(
        '(task.assignedToUserId = :userId OR task.assignedBy = :userId)',
        { userId: assignedToUserId },
      );
    } else {
      if (assignedToUserId) {
        qb.andWhere('task.assignedToUserId = :assignedToUserId', {
          assignedToUserId,
        });
      }
      if (assignedBy) {
        qb.andWhere('task.assignedBy = :assignedBy', { assignedBy });
      }
    }

    const [data, total] = await qb
      .skip(skip)
      .take(limit)
      .orderBy('task.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total };
  }

  async findOne(id: string, organisationId: string): Promise<StaffTask> {
    const task = await this.tasksRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
      relations: ['assignedToStaff', 'assignedToUser', 'assignedByUser'],
    });
    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    return task;
  }

  async update(
    id: string,
    organisationId: string,
    updateDto: UpdateTaskDto,
  ): Promise<StaffTask> {
    const task = await this.findOne(id, organisationId);

    if (
      updateDto.assignedToStaffId &&
      updateDto.assignedToStaffId !== task.assignedToStaffId
    ) {
      const staff = await this.staffRepository.findOne({
        where: { id: updateDto.assignedToStaffId, organisationId },
      });
      if (!staff) {
        throw new NotFoundException('Staff member not found');
      }
      task.assignedToUserId = staff.userId ?? null;
      task.assignedToDoctorId = null;

      if (staff.userId) {
        this.notificationsService
          .sendToUsers({
            userIds: [staff.userId],
            title: 'Task Reassigned to You',
            body: task.title,
            data: { taskId: task.id, type: 'task_assigned' },
          })
          .catch(() => {});
      }
    }

    if (updateDto.status === 'completed' && task.status !== 'completed') {
      task.completedAt = new Date();
      if (task.assignedBy && task.assignedBy !== task.assignedToUserId) {
        this.notificationsService
          .sendToUsers({
            userIds: [task.assignedBy],
            title: 'Task Completed',
            body: task.title,
            data: { taskId: task.id, type: 'task_completed' },
          })
          .catch(() => {});
      }
    }

    if (updateDto.title !== undefined) task.title = updateDto.title;
    if (updateDto.description !== undefined)
      task.description = updateDto.description ?? null;
    if (updateDto.category !== undefined)
      task.category = updateDto.category as any;
    if (updateDto.assignedToStaffId !== undefined)
      task.assignedToStaffId = updateDto.assignedToStaffId ?? null;
    if (updateDto.assignedToDoctorId !== undefined)
      task.assignedToDoctorId = updateDto.assignedToDoctorId ?? null;
    if (updateDto.dueDate !== undefined)
      task.dueDate = updateDto.dueDate ?? null;
    if (updateDto.dueTime !== undefined)
      task.dueTime = updateDto.dueTime ?? null;
    if (updateDto.priority !== undefined)
      task.priority = updateDto.priority as any;
    if (updateDto.status !== undefined)
      task.status = updateDto.status as any;
    if (updateDto.notes !== undefined) task.notes = updateDto.notes ?? null;

    return this.tasksRepository.save(task);
  }

  async remove(id: string, organisationId: string): Promise<void> {
    const task = await this.findOne(id, organisationId);
    await this.tasksRepository.softDelete(task.id);
  }
}
