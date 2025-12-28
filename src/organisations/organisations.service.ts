import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Organisation } from './entities/organisation.entity';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { GetOrganisationsDto } from './dto/get-organisations.dto';

@Injectable()
export class OrganisationsService {
  constructor(
    @InjectRepository(Organisation)
    private readonly organisationsRepository: Repository<Organisation>,
  ) {}

  async create(
    createDto: CreateOrganisationDto,
    createdBy?: string,
  ): Promise<Organisation> {
    // Check for duplicate license number if provided
    if (createDto.licenseNumber) {
      const existing = await this.organisationsRepository.findOne({
        where: { licenseNumber: createDto.licenseNumber, deletedAt: IsNull() },
      });
      if (existing) {
        throw new ConflictException('License number already exists');
      }
    }

    const organisation = this.organisationsRepository.create({
      ...createDto,
      status: createDto.status || 'active',
    });

    return await this.organisationsRepository.save(organisation);
  }

  async findAll(query: GetOrganisationsDto): Promise<{
    data: Organisation[];
    total: number;
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      type,
      status,
      approvalStatus,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.organisationsRepository
      .createQueryBuilder('org')
      .where('org.deletedAt IS NULL');

    if (search) {
      queryBuilder.andWhere(
        '(org.name ILIKE :search OR org.clinicName ILIKE :search OR org.companyName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (type) {
      queryBuilder.andWhere('org.type = :type', { type });
    }

    if (status) {
      queryBuilder.andWhere('org.status = :status', { status });
    }

    if (approvalStatus) {
      queryBuilder.andWhere('org.approvalStatus = :approvalStatus', {
        approvalStatus,
      });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('org.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total };
  }

  async findOne(id: string): Promise<Organisation> {
    const organisation = await this.organisationsRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!organisation) {
      throw new NotFoundException(`Organisation with ID ${id} not found`);
    }

    return organisation;
  }

  async update(
    id: string,
    updateDto: UpdateOrganisationDto,
  ): Promise<Organisation> {
    const organisation = await this.findOne(id);

    // Check for duplicate license number if being updated
    if (
      updateDto.licenseNumber &&
      updateDto.licenseNumber !== organisation.licenseNumber
    ) {
      const existing = await this.organisationsRepository.findOne({
        where: { licenseNumber: updateDto.licenseNumber, deletedAt: IsNull() },
      });
      if (existing) {
        throw new ConflictException('License number already exists');
      }
    }

    Object.assign(organisation, updateDto);
    return await this.organisationsRepository.save(organisation);
  }

  async remove(id: string): Promise<void> {
    const organisation = await this.findOne(id);
    await this.organisationsRepository.softDelete(organisation.id);
  }

  async approve(id: string, approvedBy: string): Promise<Organisation> {
    const organisation = await this.findOne(id);

    if (organisation.approvalStatus === 'approved') {
      throw new BadRequestException('Organisation is already approved');
    }

    organisation.approvalStatus = 'approved';
    organisation.isVerified = true;
    organisation.approvedAt = new Date();
    organisation.approvedBy = approvedBy;

    return await this.organisationsRepository.save(organisation);
  }

  async reject(
    id: string,
    rejectionReason: string,
    rejectedBy: string,
  ): Promise<Organisation> {
    const organisation = await this.findOne(id);

    if (organisation.approvalStatus === 'approved') {
      throw new BadRequestException('Cannot reject an approved organisation');
    }

    organisation.approvalStatus = 'rejected';
    organisation.rejectionReason = rejectionReason;
    organisation.approvedBy = rejectedBy;

    return await this.organisationsRepository.save(organisation);
  }
}
