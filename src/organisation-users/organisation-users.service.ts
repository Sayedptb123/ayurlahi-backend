import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { OrganisationUser } from './entities/organisation-user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { User } from '../users/entities/user.entity';
import { CreateOrganisationUserDto } from './dto/create-organisation-user.dto';
import { UpdateOrganisationUserDto } from './dto/update-organisation-user.dto';
import { GetOrganisationUsersDto } from './dto/get-organisation-users.dto';
import {
  RequestingUser,
  canManageMembership,
  canViewMembershipRow,
  getRosterAccess,
  isTeamManagementTier,
  isTeamRosterVisibleRole,
} from '../common/utils/team-access.util';

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
    requestingUser: RequestingUser,
  ): Promise<OrganisationUser> {
    if (!canManageMembership(requestingUser, createDto.organisationId)) {
      throw new ForbiddenException(
        'You do not have permission to add a member to this organisation',
      );
    }

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
      createdBy: requestingUser.userId,
    });

    return await this.organisationUsersRepository.save(organisationUser);
  }

  async findAll(
    query: GetOrganisationUsersDto,
    requestingUser: RequestingUser,
  ): Promise<{
    data: OrganisationUser[];
    total: number;
  }> {
    const { page = 1, limit = 10, userId, organisationId, role } = query;
    const skip = (page - 1) * limit;

    if (organisationId) {
      const access = getRosterAccess(requestingUser, organisationId);
      if (access === 'none') {
        throw new ForbiddenException(
          "You do not have permission to view this organisation's members",
        );
      }
      // 'filtered' access (non-member reading the Team org's roster) is
      // narrowed to FIELD_STAFF/TEAM_LEAD rows via the queryBuilder clause
      // below — see the pickup-assignee picker use case in the scope doc.
    } else if (!isTeamManagementTier(requestingUser)) {
      // Unfiltered, platform-wide listing — Team-management tier only.
      throw new ForbiddenException(
        'You do not have permission to list organisation members across organisations',
      );
    }

    const queryBuilder = this.organisationUsersRepository
      .createQueryBuilder('ou')
      .leftJoin('ou.user', 'user')
      .leftJoinAndSelect('ou.organisation', 'organisation')
      // Explicit column allowlist for the joined user — leftJoinAndSelect
      // would pull every column, including passwordHash (bcrypt hash).
      .addSelect(['user.id', 'user.firstName', 'user.lastName', 'user.email', 'user.phone', 'user.isActive']);

    if (userId) {
      queryBuilder.andWhere('ou.userId = :userId', { userId });
    }

    if (organisationId) {
      queryBuilder.andWhere('ou.organisationId = :organisationId', {
        organisationId,
      });

      if (getRosterAccess(requestingUser, organisationId) === 'filtered') {
        queryBuilder.andWhere('ou.role IN (:...visibleRoles)', {
          visibleRoles: ['FIELD_STAFF', 'TEAM_LEAD'],
        });
      }
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

  private async loadById(id: string): Promise<OrganisationUser> {
    const organisationUser = await this.organisationUsersRepository.findOne({
      where: { id },
      relations: ['user', 'organisation'],
      // Excludes passwordHash — see findAll() above for why this matters.
      select: {
        user: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true },
      },
    });

    if (!organisationUser) {
      throw new NotFoundException(`OrganisationUser with ID ${id} not found`);
    }

    return organisationUser;
  }

  async findOne(id: string, requestingUser: RequestingUser): Promise<OrganisationUser> {
    const organisationUser = await this.loadById(id);

    if (!canViewMembershipRow(requestingUser, organisationUser)) {
      throw new ForbiddenException(
        'You do not have permission to view this organisation member',
      );
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
      select: {
        user: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true },
      },
    });
  }

  async update(
    id: string,
    updateDto: UpdateOrganisationUserDto,
    requestingUser: RequestingUser,
  ): Promise<OrganisationUser> {
    const organisationUser = await this.loadById(id);

    if (!canManageMembership(requestingUser, organisationUser.organisationId)) {
      throw new ForbiddenException(
        'You do not have permission to update this organisation member',
      );
    }

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

  async remove(id: string, requestingUser: RequestingUser): Promise<void> {
    const organisationUser = await this.loadById(id);

    if (!canManageMembership(requestingUser, organisationUser.organisationId)) {
      throw new ForbiddenException(
        'You do not have permission to remove this organisation member',
      );
    }

    await this.organisationUsersRepository.softDelete(organisationUser.id);
  }

  async updateRoleByUserId(
    targetUserId: string,
    organisationId: string,
    role: string,
  ): Promise<OrganisationUser> {
    const orgUser = await this.organisationUsersRepository.findOne({
      where: { userId: targetUserId, organisationId },
    });
    if (!orgUser) {
      throw new NotFoundException(
        `Organisation user not found for userId ${targetUserId} in this organisation`,
      );
    }
    orgUser.role = role as any;
    return await this.organisationUsersRepository.save(orgUser);
  }

  async updatePermissionsByUserId(
    targetUserId: string,
    organisationId: string,
    permissions: Record<string, boolean>,
  ): Promise<OrganisationUser> {
    const orgUser = await this.organisationUsersRepository.findOne({
      where: { userId: targetUserId, organisationId },
    });

    if (!orgUser) {
      throw new NotFoundException(
        `Organisation user not found for userId ${targetUserId} in this organisation`,
      );
    }

    orgUser.permissions = permissions;
    return await this.organisationUsersRepository.save(orgUser);
  }

  async getUserOrganisations(
    userId: string,
    requestingUser: RequestingUser,
  ): Promise<Organisation[]> {
    if (userId !== requestingUser.userId && !isTeamManagementTier(requestingUser)) {
      throw new ForbiddenException(
        'You do not have permission to view this user\'s organisations',
      );
    }

    const organisationUsers = await this.organisationUsersRepository.find({
      where: { userId },
      relations: ['organisation'],
    });

    return organisationUsers.map((ou) => ou.organisation);
  }

  async getOrganisationUsers(
    organisationId: string,
    requestingUser: RequestingUser,
  ): Promise<any[]> {
    const access = getRosterAccess(requestingUser, organisationId);
    if (access === 'none') {
      throw new ForbiddenException(
        "You do not have permission to view this organisation's members",
      );
    }

    const organisationUsers = await this.organisationUsersRepository.find({
      where: { organisationId },
      relations: ['user'],
      // Excludes passwordHash before it ever reaches the `{ ...ou.user }`
      // spread below — see findAll() above for why this matters.
      select: {
        user: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true },
      },
    });

    const rows = organisationUsers
      .filter((ou) => ou.user)
      .map((ou) => ({ ...ou.user, role: ou.role }));

    return access === 'filtered'
      ? rows.filter((row) => isTeamRosterVisibleRole(row.role))
      : rows;
  }
}
