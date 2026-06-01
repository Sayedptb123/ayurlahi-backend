import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Like } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { normalizePhone } from '../common/utils/phone.util';
import { GetUsersDto } from './dto/get-users.dto';
import { RoleUtils } from '../common/utils/role.utils';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Organisation)
    private organisationsRepository: Repository<Organisation>,
    @InjectRepository(OrganisationUser)
    private organisationUsersRepository: Repository<OrganisationUser>,
  ) { }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
    });
  }

  async findAll(userRole: string, query: GetUsersDto) {
    // Only admin and support can list all users
    if (!RoleUtils.isAdminOrSupport(userRole)) {
      throw new ForbiddenException('You do not have permission to view users');
    }

    const { page = 1, limit = 20, search, email } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    // Note: Role filtering removed - roles are now in organisation_users table
    // To filter by role, would need to join with organisation_users

    if (email) {
      queryBuilder.andWhere('user.email = :email', { email });
    }

    if (search) {
      queryBuilder.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await queryBuilder.getCount();
    queryBuilder.skip(skip).take(limit);
    queryBuilder.orderBy('user.createdAt', 'DESC');

    // Note: user no longer has manufacturerId/clinicId columns; org membership via organisation_users

    const data = await queryBuilder.getMany();

    const users = data.map((user: any) => {
      const { passwordHash, ...userWithoutPassword } = user;
      return {
        ...userWithoutPassword,
        name: `${user.firstName} ${user.lastName}`,
      };
    });

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userRole: string) {
    // Only admin and support can view user details
    if (!RoleUtils.isAdminOrSupport(userRole)) {
      throw new ForbiddenException('You do not have permission to view users');
    }

    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Remove password hash from response
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async create(userRole: string, createUserDto: CreateUserDto) {
    // Only admin can create users
    if (!RoleUtils.isAdmin(userRole)) {
      throw new ForbiddenException('Only admins can create users');
    }

    // Check if email already exists
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(createUserDto.password, salt);

    // Phone is required in the new structure
    if (!createUserDto.phone) {
      throw new BadRequestException('Phone number is required');
    }

    const user = this.usersRepository.create({
      email: createUserDto.email || null,
      passwordHash,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      phone: normalizePhone(createUserDto.phone) as string,
      isActive:
        createUserDto.isActive !== undefined ? createUserDto.isActive : true,
      isEmailVerified: false,
    });

    let savedUser: User;
    try {
      savedUser = await this.usersRepository.save(user);
    } catch (err: any) {
      if (err.code === '23505') {
        if (err.detail?.includes('phone')) {
          throw new ConflictException('A user with this phone number already exists');
        }
        if (err.detail?.includes('email')) {
          throw new ConflictException('A user with this email address already exists');
        }
        throw new ConflictException('A user with this email or phone already exists');
      }
      throw err;
    }

    // If role is MANUFACTURER or CLINIC and organizationName is provided, create organisation
    if (
      (createUserDto.role === 'manufacturer' || createUserDto.role === 'clinic') &&
      createUserDto.organizationName
    ) {
      const orgType = createUserDto.role === 'manufacturer' ? 'MANUFACTURER' : 'CLINIC';

      const org = this.organisationsRepository.create({
        name: createUserDto.organizationName,
        type: orgType as any,
        approvalStatus: 'approved',
        isActive: true,
      });

      const savedOrg = await this.organisationsRepository.save(org);

      // Link User to Organisation via OrganisationUser
      const orgUser = this.organisationUsersRepository.create({
        userId: savedUser.id,
        organisationId: savedOrg.id,
        role: 'OWNER', // Default to owner for the first user
        isActive: true,
      });

      await this.organisationUsersRepository.save(orgUser);
    }

    // Remove password hash from response
    const { passwordHash: _, ...userWithoutPassword } = savedUser;
    return userWithoutPassword;
  }

  async update(id: string, userRole: string, updateUserDto: UpdateUserDto) {
    // Only admin can update users
    if (!RoleUtils.isAdmin(userRole)) {
      throw new ForbiddenException('Only admins can update users');
    }

    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Check if email is being changed and if it already exists
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.findByEmail(updateUserDto.email);
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // Hash password if provided
    let passwordHash = user.passwordHash;
    if (updateUserDto.password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(updateUserDto.password, salt);
    }

    // Update user (only fields that exist in new structure)
    Object.assign(user, {
      email:
        updateUserDto.email !== undefined ? updateUserDto.email : user.email,
      passwordHash,
      firstName: updateUserDto.firstName || user.firstName,
      lastName: updateUserDto.lastName || user.lastName,
      phone:
        updateUserDto.phone !== undefined ? normalizePhone(updateUserDto.phone) as string : user.phone,
      isActive:
        updateUserDto.isActive !== undefined
          ? updateUserDto.isActive
          : user.isActive,
    });

    const updatedUser = await this.usersRepository.save(user);

    // Remove password hash from response
    const { passwordHash: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  async remove(id: string, userRole: string) {
    // Only admin can delete users
    if (!RoleUtils.isAdmin(userRole)) {
      throw new ForbiddenException('Only admins can delete users');
    }

    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.usersRepository.remove(user);
    return { message: 'User deleted successfully' };
  }
}
