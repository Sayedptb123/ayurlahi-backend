import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { OrganisationUser } from './entities/organisation-user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { User } from '../users/entities/user.entity';
import { CreateOrganisationUserDto } from './dto/create-organisation-user.dto';
import { UpdateOrganisationUserDto } from './dto/update-organisation-user.dto';
import { GetOrganisationUsersDto } from './dto/get-organisation-users.dto';

@Injectable()
export class OrganisationUsersService {
  constructor(
    @InjectRepository(OrganisationUser)
    private readonly organisationUsersRepository: Repository<OrganisationUser>,
    @InjectRepository(Organisation)
    private readonly organisationsRepository: Repository<Organisation>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(
    createDto: CreateOrganisationUserDto,
    createdBy?: string,
  ): Promise<OrganisationUser> {
    // Verify user exists
    const user = await this.usersRepository.findOne({
      where: { id: createDto.userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${createDto.userId} not found`);
    }

    // Verify organisation exists
    const organisation = await this.organisationsRepository.findOne({
      where: { id: createDto.organisationId, deletedAt: IsNull() },
    });
    if (!organisation) {
      throw new NotFoundException(
        `Organisation with ID ${createDto.organisationId} not found`,
      );
    }

    // Check if user already has this role in this organisation
    const existing = await this.organisationUsersRepository.findOne({
      where: {
        userId: createDto.userId,
        organisationId: createDto.organisationId,
        role: createDto.role,
      },
    });
    if (existing) {
      throw new ConflictException(
        'User already has this role in this organisation',
      );
    }

    // If setting as primary, unset other primary users
    if (createDto.isPrimary) {
      await this.organisationUsersRepository.update(
        { organisationId: createDto.organisationId, isPrimary: true },
        { isPrimary: false },
      );
    }

    const organisationUser = this.organisationUsersRepository.create({
      ...createDto,
      createdBy,
    });

    return await this.organisationUsersRepository.save(organisationUser);
  }

  async findAll(query: GetOrganisationUsersDto): Promise<{
    data: OrganisationUser[];
    total: number;
  }> {
    const { page = 1, limit = 10, userId, organisationId, role } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.organisationUsersRepository
      .createQueryBuilder('ou')
      .leftJoinAndSelect('ou.user', 'user')
      .leftJoinAndSelect('ou.organisation', 'organisation');

    if (userId) {
      queryBuilder.andWhere('ou.userId = :userId', { userId });
    }

    if (organisationId) {
      queryBuilder.andWhere('ou.organisationId = :organisationId', {
        organisationId,
      });
    }

    if (role) {
      queryBuilder.andWhere('ou.role = :role', { role });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('ou.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total };
  }

  async findOne(id: string): Promise<OrganisationUser> {
    const organisationUser = await this.organisationUsersRepository.findOne({
      where: { id },
      relations: ['user', 'organisation'],
    });

    if (!organisationUser) {
      throw new NotFoundException(`OrganisationUser with ID ${id} not found`);
    }

    return organisationUser;
  }

  async findByUserAndOrganisation(
    userId: string,
    organisationId: string,
  ): Promise<OrganisationUser[]> {
    return await this.organisationUsersRepository.find({
      where: { userId, organisationId },
      relations: ['user', 'organisation'],
    });
  }

  async update(
    id: string,
    updateDto: UpdateOrganisationUserDto,
  ): Promise<OrganisationUser> {
    const organisationUser = await this.findOne(id);

    // If setting as primary, unset other primary users
    if (updateDto.isPrimary && !organisationUser.isPrimary) {
      await this.organisationUsersRepository.update(
        {
          organisationId: organisationUser.organisationId,
          isPrimary: true,
        },
        { isPrimary: false },
      );
    }

    Object.assign(organisationUser, updateDto);
    return await this.organisationUsersRepository.save(organisationUser);
  }

  async remove(id: string): Promise<void> {
    const organisationUser = await this.findOne(id);
    await this.organisationUsersRepository.remove(organisationUser);
  }

  async getUserOrganisations(userId: string): Promise<Organisation[]> {
    const organisationUsers = await this.organisationUsersRepository.find({
      where: { userId },
      relations: ['organisation'],
    });

    return organisationUsers.map((ou) => ou.organisation);
  }

  async getOrganisationUsers(organisationId: string): Promise<User[]> {
    const organisationUsers = await this.organisationUsersRepository.find({
      where: { organisationId },
      relations: ['user'],
    });

    return organisationUsers.map((ou) => ou.user);
  }
}
