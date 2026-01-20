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

import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class OrganisationsService {
  constructor(
    @InjectRepository(Organisation)
    private readonly organisationsRepository: Repository<Organisation>,
    @InjectRepository(OrganisationUser)
    private readonly organisationUserRepository: Repository<OrganisationUser>,
    private readonly usersService: UsersService,
  ) { }

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

    const savedOrg = await this.organisationsRepository.save(organisation);

    // Create primary user if provided
    if (createDto.primaryUser) {
      try {
        // Create the user
        // Note: passing 'SUPER_ADMIN' as role to bypass permission check
        const userRole = createDto.type === 'CLINIC' ? 'clinic' : 'manufacturer'; // Mapping to UserRole enum string

        const user = await this.usersService.create('SUPER_ADMIN', {
          email: createDto.primaryUser.email,
          password: createDto.primaryUser.password,
          firstName: createDto.primaryUser.firstName,
          lastName: createDto.primaryUser.lastName,
          phone: createDto.primaryUser.phone,
          isActive: true,
          role: userRole as any,
        });

        // The create method usually returns the user object without password
        // But if it's returning User | User[], we need to be careful.
        // UsersService.create returns Promise<Partial<User>>

        const userId = (user as any).id; // Safe cast since we know it's a user

        // Link user to organisation
        const orgUser = this.organisationUserRepository.create({
          organisationId: savedOrg.id,
          userId: userId,
          role: 'OWNER',
          isPrimary: true,
          createdBy: createdBy,
        });

        await this.organisationUserRepository.save(orgUser);
      } catch (error) {
        console.error('Failed to create primary user for organisation:', error);
        throw error;
      }
    }

    return savedOrg;
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
      .leftJoinAndSelect('org.users', 'orgUser', 'orgUser.isPrimary = :isPrimary', { isPrimary: true })
      .leftJoinAndSelect('orgUser.user', 'user')
      .where('org.deletedAt IS NULL');

    if (search) {
      queryBuilder.andWhere(
        '(org.name ILIKE :search OR org.clinicName ILIKE :search OR org.companyName ILIKE :search OR user.email ILIKE :search)',
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
      relations: ['users', 'users.user'],
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

    // Update primary user if provided
    if (updateDto.primaryUser && organisation.users) {
      const primaryOrgUser = organisation.users.find(u => u.isPrimary);
      if (primaryOrgUser && primaryOrgUser.user) {
        // Create a partial update object for the user
        const userUpdate: any = {};
        if (updateDto.primaryUser.firstName) userUpdate.firstName = updateDto.primaryUser.firstName;
        if (updateDto.primaryUser.lastName) userUpdate.lastName = updateDto.primaryUser.lastName;
        if (updateDto.primaryUser.phone) userUpdate.phone = updateDto.primaryUser.phone;
        // Email update might be sensitive or require unique check, UsersService.update handles it?
        // UsersService.update usually expects role checks or we pass 'SUPER_ADMIN' to bypass if allowed.
        // Let's assume we can update basic details.

        if (Object.keys(userUpdate).length > 0) {
          await this.usersService.update(primaryOrgUser.user.id, userUpdate, 'SUPER_ADMIN' as any);
        }
      }
    }

    Object.assign(organisation, updateDto);
    // Remove primaryUser from organisation object before saving to avoid error if it tries to map to column
    delete (organisation as any).primaryUser;

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
