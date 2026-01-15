import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull } from 'typeorm';
import { DutyAssignment, DutyStatus } from './entities/duty-assignment.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Staff } from '../staff/entities/staff.entity';
import { DutyType } from '../duty-types/entities/duty-type.entity';
import { CreateDutyAssignmentDto } from './dto/create-duty-assignment.dto';
import { UpdateDutyAssignmentDto } from './dto/update-duty-assignment.dto';
import { GetDutyAssignmentsDto } from './dto/get-duty-assignments.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';

@Injectable()
export class DutyAssignmentsService {
  constructor(
    @InjectRepository(DutyAssignment)
    private readonly assignmentsRepository: Repository<DutyAssignment>,
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    @InjectRepository(DutyType)
    private readonly dutyTypesRepository: Repository<DutyType>,
  ) {}

  async create(
    organisationId: string,
    createDto: CreateDutyAssignmentDto,
    assignedBy?: string,
  ): Promise<DutyAssignment> {
    // Verify branch if provided
    if (createDto.branchId) {
      const branch = await this.branchesRepository.findOne({
        where: { id: createDto.branchId, organisationId, deletedAt: IsNull() },
      });
      if (!branch) {
        throw new NotFoundException('Branch not found');
      }
    }

    // Verify staff exists and belongs to organisation
    const staff = await this.staffRepository.findOne({
      where: { id: createDto.staffId, organizationId: organisationId },
    });
    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    // Verify duty type exists
    const dutyType = await this.dutyTypesRepository.findOne({
      where: { id: createDto.dutyTypeId, organisationId, deletedAt: IsNull() },
    });
    if (!dutyType) {
      throw new NotFoundException('Duty type not found');
    }

    // Check for overlapping assignments
    await this.checkOverlap(
      createDto.staffId,
      createDto.dutyDate,
      createDto.startTime || dutyType.startTime,
      createDto.endTime || dutyType.endTime,
    );

    const assignment = this.assignmentsRepository.create({
      ...createDto,
      organisationId,
      dutyDate: new Date(createDto.dutyDate),
      startTime: createDto.startTime || dutyType.startTime,
      endTime: createDto.endTime || dutyType.endTime,
      assignedBy,
    });

    return await this.assignmentsRepository.save(assignment);
  }

  async findAll(
    organisationId: string,
    query: GetDutyAssignmentsDto,
  ): Promise<{ data: DutyAssignment[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      branchId,
      staffId,
      dutyTypeId,
      startDate,
      endDate,
      status,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.assignmentsRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.branch', 'branch')
      .leftJoinAndSelect('assignment.staff', 'staff')
      .leftJoinAndSelect('assignment.dutyType', 'dutyType')
      .where('assignment.organisationId = :organisationId', {
        organisationId,
      })
      .andWhere('assignment.deletedAt IS NULL');

    if (branchId) {
      queryBuilder.andWhere('assignment.branchId = :branchId', { branchId });
    }

    if (staffId) {
      queryBuilder.andWhere('assignment.staffId = :staffId', { staffId });
    }

    if (dutyTypeId) {
      queryBuilder.andWhere('assignment.dutyTypeId = :dutyTypeId', {
        dutyTypeId,
      });
    }

    if (startDate) {
      queryBuilder.andWhere('assignment.dutyDate >= :startDate', {
        startDate,
      });
    }

    if (endDate) {
      queryBuilder.andWhere('assignment.dutyDate <= :endDate', { endDate });
    }

    if (status) {
      queryBuilder.andWhere('assignment.status = :status', { status });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('assignment.dutyDate', 'DESC')
      .addOrderBy('assignment.startTime', 'ASC')
      .getManyAndCount();

    return { data, total };
  }

  async findOne(id: string, organisationId: string): Promise<DutyAssignment> {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
      relations: ['branch', 'staff', 'dutyType'],
    });

    if (!assignment) {
      throw new NotFoundException(`Duty assignment with ID ${id} not found`);
    }

    return assignment;
  }

  async update(
    id: string,
    organisationId: string,
    updateDto: UpdateDutyAssignmentDto,
  ): Promise<DutyAssignment> {
    const assignment = await this.findOne(id, organisationId);

    // If updating staff, verify they exist
    if (updateDto.staffId && updateDto.staffId !== assignment.staffId) {
      const staff = await this.staffRepository.findOne({
        where: { id: updateDto.staffId, organizationId: organisationId },
      });
      if (!staff) {
        throw new NotFoundException('Staff not found');
      }
    }

    // If updating duty type, verify it exists
    if (
      updateDto.dutyTypeId &&
      updateDto.dutyTypeId !== assignment.dutyTypeId
    ) {
      const dutyType = await this.dutyTypesRepository.findOne({
        where: {
          id: updateDto.dutyTypeId,
          organisationId,
          deletedAt: IsNull(),
        },
      });
      if (!dutyType) {
        throw new NotFoundException('Duty type not found');
      }
    }

    // Check for overlaps if date/time changed
    if (updateDto.dutyDate || updateDto.startTime || updateDto.endTime) {
      const dutyDate = updateDto.dutyDate
        ? new Date(updateDto.dutyDate)
        : assignment.dutyDate;
      const startTime = updateDto.startTime || assignment.startTime || '';
      const endTime = updateDto.endTime || assignment.endTime || '';

      await this.checkOverlap(
        updateDto.staffId || assignment.staffId,
        dutyDate,
        startTime,
        endTime,
        assignment.id, // Exclude current assignment
      );
    }

    Object.assign(assignment, updateDto);
    if (updateDto.dutyDate) {
      assignment.dutyDate = new Date(updateDto.dutyDate);
    }

    return await this.assignmentsRepository.save(assignment);
  }

  async remove(id: string, organisationId: string): Promise<void> {
    const assignment = await this.findOne(id, organisationId);
    await this.assignmentsRepository.softDelete(assignment.id);
  }

  async checkIn(
    id: string,
    organisationId: string,
    checkInDto: CheckInDto,
  ): Promise<DutyAssignment> {
    const assignment = await this.findOne(id, organisationId);

    if (assignment.status !== 'scheduled') {
      throw new BadRequestException('Can only check in to scheduled duties');
    }

    assignment.status = 'in_progress';
    assignment.checkedInAt = new Date();
    if (checkInDto.location) {
      assignment.checkInLocation = checkInDto.location;
    }

    return await this.assignmentsRepository.save(assignment);
  }

  async checkOut(
    id: string,
    organisationId: string,
    checkOutDto: CheckOutDto,
  ): Promise<DutyAssignment> {
    const assignment = await this.findOne(id, organisationId);

    if (assignment.status !== 'in_progress') {
      throw new BadRequestException(
        'Can only check out from in-progress duties',
      );
    }

    assignment.status = 'completed';
    assignment.checkedOutAt = new Date();
    if (checkOutDto.location) {
      assignment.checkOutLocation = checkOutDto.location;
    }

    return await this.assignmentsRepository.save(assignment);
  }

  private async checkOverlap(
    staffId: string,
    dutyDate: Date | string,
    startTime: string,
    endTime: string,
    excludeId?: string,
  ): Promise<void> {
    const date = typeof dutyDate === 'string' ? new Date(dutyDate) : dutyDate;
    const dateStr = date.toISOString().split('T')[0];

    const queryBuilder = this.assignmentsRepository
      .createQueryBuilder('assignment')
      .where('assignment.staffId = :staffId', { staffId })
      .andWhere('assignment.dutyDate = :date', { date: dateStr })
      .andWhere('assignment.status != :cancelled', { cancelled: 'cancelled' })
      .andWhere('assignment.deletedAt IS NULL');

    if (excludeId) {
      queryBuilder.andWhere('assignment.id != :excludeId', { excludeId });
    }

    const existing = await queryBuilder.getMany();

    // Simple overlap check (can be enhanced)
    for (const existingAssignment of existing) {
      const existingStart = existingAssignment.startTime || '';
      const existingEnd = existingAssignment.endTime || '';

      if (this.timesOverlap(startTime, endTime, existingStart, existingEnd)) {
        throw new ConflictException(
          'Staff already has a duty assignment at this time',
        );
      }
    }
  }

  private timesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string,
  ): boolean {
    const [start1Hours, start1Minutes] = start1.split(':').map(Number);
    const [end1Hours, end1Minutes] = end1.split(':').map(Number);
    const [start2Hours, start2Minutes] = start2.split(':').map(Number);
    const [end2Hours, end2Minutes] = end2.split(':').map(Number);

    const start1Total = start1Hours * 60 + start1Minutes;
    const end1Total = end1Hours * 60 + end1Minutes;
    const start2Total = start2Hours * 60 + start2Minutes;
    const end2Total = end2Hours * 60 + end2Minutes;

    return start1Total < end2Total && start2Total < end1Total;
  }
}


