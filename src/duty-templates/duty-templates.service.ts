import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { DutyTemplate } from './entities/duty-template.entity';
import { Branch } from '../branches/entities/branch.entity';
import { DutyAssignmentsService } from '../duty-assignments/duty-assignments.service';
import { CreateDutyTemplateDto } from './dto/create-duty-template.dto';
import { UpdateDutyTemplateDto } from './dto/update-duty-template.dto';
import { GetDutyTemplatesDto } from './dto/get-duty-templates.dto';
import { ApplyTemplateDto } from './dto/apply-template.dto';

@Injectable()
export class DutyTemplatesService {
  constructor(
    @InjectRepository(DutyTemplate)
    private readonly templatesRepository: Repository<DutyTemplate>,
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
    private readonly dutyAssignmentsService: DutyAssignmentsService,
  ) {}

  async create(
    organisationId: string,
    createDto: CreateDutyTemplateDto,
    createdBy?: string,
  ): Promise<DutyTemplate> {
    // Verify branch if provided
    if (createDto.branchId) {
      const branch = await this.branchesRepository.findOne({
        where: { id: createDto.branchId, organisationId, deletedAt: IsNull() },
      });
      if (!branch) {
        throw new NotFoundException('Branch not found');
      }
    }

    // Validate schedule pattern
    this.validateSchedulePattern(createDto.schedulePattern);

    const template = this.templatesRepository.create({
      ...createDto,
      organisationId,
      createdBy,
    });

    return await this.templatesRepository.save(template);
  }

  async findAll(
    organisationId: string,
    query: GetDutyTemplatesDto,
  ): Promise<{ data: DutyTemplate[]; total: number }> {
    const { page = 1, limit = 10, search, branchId, isActive } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.templatesRepository
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.branch', 'branch')
      .where('template.organisationId = :organisationId', { organisationId })
      .andWhere('template.deletedAt IS NULL');

    if (search) {
      queryBuilder.andWhere('template.name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (branchId) {
      queryBuilder.andWhere('template.branchId = :branchId', { branchId });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('template.isActive = :isActive', { isActive });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('template.name', 'ASC')
      .getManyAndCount();

    return { data, total };
  }

  async findOne(id: string, organisationId: string): Promise<DutyTemplate> {
    const template = await this.templatesRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
      relations: ['branch'],
    });

    if (!template) {
      throw new NotFoundException(`Duty template with ID ${id} not found`);
    }

    return template;
  }

  async update(
    id: string,
    organisationId: string,
    updateDto: UpdateDutyTemplateDto,
  ): Promise<DutyTemplate> {
    const template = await this.findOne(id, organisationId);

    // Verify branch if being updated
    if (updateDto.branchId && updateDto.branchId !== template.branchId) {
      const branch = await this.branchesRepository.findOne({
        where: { id: updateDto.branchId, organisationId, deletedAt: IsNull() },
      });
      if (!branch) {
        throw new NotFoundException('Branch not found');
      }
    }

    // Validate schedule pattern if being updated
    if (updateDto.schedulePattern) {
      this.validateSchedulePattern(updateDto.schedulePattern);
    }

    Object.assign(template, updateDto);
    return await this.templatesRepository.save(template);
  }

  async remove(id: string, organisationId: string): Promise<void> {
    const template = await this.findOne(id, organisationId);
    await this.templatesRepository.softDelete(template.id);
  }

  async applyTemplate(
    id: string,
    organisationId: string,
    applyDto: ApplyTemplateDto,
    assignedBy?: string,
  ): Promise<{ created: number; errors: string[] }> {
    const template = await this.findOne(id, organisationId);

    if (!template.isActive) {
      throw new BadRequestException('Template is not active');
    }

    const startDate = new Date(applyDto.startDate);
    const endDate = applyDto.endDate
      ? new Date(applyDto.endDate)
      : this.calculateEndDate(template, startDate);

    const schedulePattern = template.schedulePattern;
    const assignments = schedulePattern.assignments || [];

    let created = 0;
    const errors: string[] = [];

    // Generate assignments based on pattern
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayOfWeekAdjusted = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert to 1-7 (Monday-Sunday)

      for (const assignment of assignments) {
        if (assignment.day_of_week === dayOfWeekAdjusted) {
          try {
            await this.dutyAssignmentsService.create(
              organisationId,
              {
                branchId: template.branchId || undefined,
                staffId: assignment.staff_id,
                dutyTypeId: assignment.duty_type_id,
                dutyDate: currentDate.toISOString().split('T')[0],
              },
              assignedBy,
            );
            created++;
          } catch (error) {
            errors.push(
              `Failed to create assignment for ${currentDate.toISOString().split('T')[0]}: ${error.message}`,
            );
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return { created, errors };
  }

  private validateSchedulePattern(pattern: Record<string, any>): void {
    if (!pattern.type) {
      throw new BadRequestException('Schedule pattern must have a type');
    }

    if (!pattern.assignments || !Array.isArray(pattern.assignments)) {
      throw new BadRequestException(
        'Schedule pattern must have an assignments array',
      );
    }

    for (const assignment of pattern.assignments) {
      if (!assignment.staff_id || !assignment.duty_type_id) {
        throw new BadRequestException(
          'Each assignment must have staff_id and duty_type_id',
        );
      }

      if (
        assignment.day_of_week &&
        (assignment.day_of_week < 1 || assignment.day_of_week > 7)
      ) {
        throw new BadRequestException(
          'day_of_week must be between 1 (Monday) and 7 (Sunday)',
        );
      }
    }
  }

  private calculateEndDate(template: DutyTemplate, startDate: Date): Date {
    const endDate = new Date(startDate);

    if (template.isRecurring && template.recurrencePattern) {
      const pattern = template.recurrencePattern;
      if (pattern.duration_weeks) {
        endDate.setDate(endDate.getDate() + pattern.duration_weeks * 7);
      } else if (pattern.duration_months) {
        endDate.setMonth(endDate.getMonth() + pattern.duration_months);
      } else {
        // Default to 4 weeks
        endDate.setDate(endDate.getDate() + 28);
      }
    } else {
      // Default to 4 weeks
      endDate.setDate(endDate.getDate() + 28);
    }

    return endDate;
  }
}


