import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { DutyType } from './entities/duty-type.entity';
import { CreateDutyTypeDto } from './dto/create-duty-type.dto';
import { UpdateDutyTypeDto } from './dto/update-duty-type.dto';
import { GetDutyTypesDto } from './dto/get-duty-types.dto';

@Injectable()
export class DutyTypesService {
  constructor(
    @InjectRepository(DutyType)
    private readonly dutyTypesRepository: Repository<DutyType>,
  ) {}

  async create(
    organisationId: string,
    createDto: CreateDutyTypeDto,
    createdBy?: string,
  ): Promise<DutyType> {
    // Check for duplicate name
    const existing = await this.dutyTypesRepository.findOne({
      where: {
        organisationId,
        name: createDto.name,
        deletedAt: IsNull(),
      },
    });
    if (existing) {
      throw new ConflictException('Duty type with this name already exists');
    }

    // Calculate duration
    const durationHours = this.calculateDuration(
      createDto.startTime,
      createDto.endTime,
    );

    const dutyType = this.dutyTypesRepository.create({
      ...createDto,
      organisationId,
      durationHours,
      createdBy,
    });

    return await this.dutyTypesRepository.save(dutyType);
  }

  async findAll(
    organisationId: string,
    query: GetDutyTypesDto,
  ): Promise<{ data: DutyType[]; total: number }> {
    const { page = 1, limit = 10, search, isActive } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.dutyTypesRepository
      .createQueryBuilder('dutyType')
      .where('dutyType.organisationId = :organisationId', { organisationId })
      .andWhere('dutyType.deletedAt IS NULL');

    if (search) {
      queryBuilder.andWhere(
        '(dutyType.name ILIKE :search OR dutyType.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('dutyType.isActive = :isActive', { isActive });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('dutyType.name', 'ASC')
      .getManyAndCount();

    return { data, total };
  }

  async findOne(id: string, organisationId: string): Promise<DutyType> {
    const dutyType = await this.dutyTypesRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
    });

    if (!dutyType) {
      throw new NotFoundException(`Duty type with ID ${id} not found`);
    }

    return dutyType;
  }

  async update(
    id: string,
    organisationId: string,
    updateDto: UpdateDutyTypeDto,
  ): Promise<DutyType> {
    const dutyType = await this.findOne(id, organisationId);

    // Check for duplicate name if being updated
    if (updateDto.name && updateDto.name !== dutyType.name) {
      const existing = await this.dutyTypesRepository.findOne({
        where: {
          organisationId,
          name: updateDto.name,
          deletedAt: IsNull(),
        },
      });
      if (existing) {
        throw new ConflictException('Duty type with this name already exists');
      }
    }

    // Recalculate duration if times changed
    if (updateDto.startTime || updateDto.endTime) {
      const startTime = updateDto.startTime || dutyType.startTime;
      const endTime = updateDto.endTime || dutyType.endTime;
      updateDto['durationHours'] = this.calculateDuration(startTime, endTime);
    }

    Object.assign(dutyType, updateDto);
    return await this.dutyTypesRepository.save(dutyType);
  }

  async remove(id: string, organisationId: string): Promise<void> {
    const dutyType = await this.findOne(id, organisationId);
    await this.dutyTypesRepository.softDelete(dutyType.id);
  }

  private calculateDuration(startTime: string, endTime: string): number {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;

    // Handle overnight shifts (end time is next day)
    let durationMinutes = endTotalMinutes - startTotalMinutes;
    if (durationMinutes < 0) {
      durationMinutes += 24 * 60; // Add 24 hours
    }

    return Math.round((durationMinutes / 60) * 100) / 100; // Round to 2 decimals
  }
}

