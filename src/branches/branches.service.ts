import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Branch } from './entities/branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { GetBranchesDto } from './dto/get-branches.dto';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
  ) {}

  async create(
    organisationId: string,
    createDto: CreateBranchDto,
    createdBy?: string,
  ): Promise<Branch> {
    // Check for duplicate branch code if provided
    if (createDto.code) {
      const existing = await this.branchesRepository.findOne({
        where: {
          organisationId,
          code: createDto.code,
          deletedAt: IsNull(),
        },
      });
      if (existing) {
        throw new ConflictException('Branch code already exists');
      }
    }

    // If setting as primary, unset other primary branches
    if (createDto.isPrimary) {
      await this.branchesRepository.update(
        { organisationId, isPrimary: true, deletedAt: IsNull() },
        { isPrimary: false },
      );
    }

    const branch = this.branchesRepository.create({
      ...createDto,
      organisationId,
      createdBy,
    });

    return await this.branchesRepository.save(branch);
  }

  async findAll(
    organisationId: string,
    query: GetBranchesDto,
  ): Promise<{ data: Branch[]; total: number }> {
    const { page = 1, limit = 10, search, isActive, isPrimary } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.branchesRepository
      .createQueryBuilder('branch')
      .where('branch.organisationId = :organisationId', { organisationId })
      .andWhere('branch.deletedAt IS NULL');

    if (search) {
      queryBuilder.andWhere(
        '(branch.name ILIKE :search OR branch.code ILIKE :search OR branch.city ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('branch.isActive = :isActive', { isActive });
    }

    if (isPrimary !== undefined) {
      queryBuilder.andWhere('branch.isPrimary = :isPrimary', { isPrimary });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('branch.isPrimary', 'DESC')
      .addOrderBy('branch.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total };
  }

  async findOne(id: string, organisationId: string): Promise<Branch> {
    const branch = await this.branchesRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
      relations: ['manager'],
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }

    return branch;
  }

  async update(
    id: string,
    organisationId: string,
    updateDto: UpdateBranchDto,
  ): Promise<Branch> {
    const branch = await this.findOne(id, organisationId);

    // Check for duplicate branch code if being updated
    if (updateDto.code && updateDto.code !== branch.code) {
      const existing = await this.branchesRepository.findOne({
        where: {
          organisationId,
          code: updateDto.code,
          deletedAt: IsNull(),
        },
      });
      if (existing) {
        throw new ConflictException('Branch code already exists');
      }
    }

    // If setting as primary, unset other primary branches
    if (updateDto.isPrimary && !branch.isPrimary) {
      await this.branchesRepository.update(
        { organisationId, isPrimary: true, deletedAt: IsNull() },
        { isPrimary: false },
      );
    }

    Object.assign(branch, updateDto);
    return await this.branchesRepository.save(branch);
  }

  async remove(id: string, organisationId: string): Promise<void> {
    const branch = await this.findOne(id, organisationId);
    await this.branchesRepository.softDelete(branch.id);
  }

  async getPrimaryBranch(organisationId: string): Promise<Branch | null> {
    return await this.branchesRepository.findOne({
      where: {
        organisationId,
        isPrimary: true,
        isActive: true,
        deletedAt: IsNull(),
      },
    });
  }
}


