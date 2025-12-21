import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { RegisterDto } from '../auth/dto/register.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from '../common/enums/role.enum';
import { generateSecurePassword } from './utils/password-generator.util';
import { EmailService } from './services/email.service';
import { ClinicsService } from '../clinics/clinics.service';
import { ManufacturersService } from '../manufacturers/manufacturers.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private configService: ConfigService,
    private emailService: EmailService,
    private clinicsService: ClinicsService,
    private manufacturersService: ManufacturersService,
  ) {}

  async create(createUserDto: RegisterDto): Promise<User> {
    const user = this.usersRepository.create(createUserDto);
    return this.usersRepository.save(user);
  }

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    // Check if email already exists
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('Email is already taken');
    }

    // Validate organization name for clinic/manufacturer roles
    if (
      (createUserDto.role === UserRole.CLINIC ||
        createUserDto.role === UserRole.MANUFACTURER) &&
      !createUserDto.organizationName
    ) {
      throw new BadRequestException(
        'Organization name is required for clinic and manufacturer roles',
      );
    }

    // Generate password if not provided
    let password = createUserDto.password;
    if (!password) {
      password = generateSecurePassword(12);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      password,
      parseInt(this.configService.get<string>('BCRYPT_ROUNDS', '10')),
    );

    // Create user
    const newUser = this.usersRepository.create({
      email: createUserDto.email,
      password: hashedPassword,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      role: createUserDto.role,
      phone: createUserDto.phone,
      whatsappNumber: createUserDto.whatsappNumber,
      isActive: createUserDto.isActive !== undefined ? createUserDto.isActive : true,
      isEmailVerified: false,
    });

    const savedUser = await this.usersRepository.save(newUser);

    // Create organization if needed
    if (createUserDto.role === UserRole.CLINIC && createUserDto.organizationName) {
      await this.clinicsService.create(savedUser.id, {
        clinicName: createUserDto.organizationName,
        licenseNumber: `TEMP-${Date.now()}`, // Temporary, should be updated
        address: 'To be updated',
        city: 'To be updated',
        state: 'To be updated',
        pincode: '000000',
        country: 'India',
      });
    } else if (
      createUserDto.role === UserRole.MANUFACTURER &&
      createUserDto.organizationName
    ) {
      await this.manufacturersService.create(savedUser.id, {
        companyName: createUserDto.organizationName,
        gstin: `TEMP-${Date.now()}`, // Temporary, should be updated
        licenseNumber: `TEMP-${Date.now()}`, // Temporary, should be updated
        address: 'To be updated',
        city: 'To be updated',
        state: 'To be updated',
        pincode: '000000',
        country: 'India',
      });
    }

    // Send welcome email if requested
    if (createUserDto.sendWelcomeEmail) {
      try {
        await this.emailService.sendWelcomeEmail(
          savedUser.email,
          savedUser.firstName,
          password, // Send plain password only in email
        );
      } catch (error) {
        // Log error but don't fail user creation
        console.error('Failed to send welcome email:', error);
      }
    }

    // Return user with relations, transformed to match frontend format
    const createdUser = await this.findOne(savedUser.id);
    return this.transformUserResponse(createdUser);
  }

  async findAll(
    page?: number,
    limit?: number,
    role?: UserRole,
    isActive?: boolean,
    search?: string,
  ): Promise<{ data: User[]; pagination?: any } | User[]> {
    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.clinic', 'clinic')
      .leftJoinAndSelect('user.manufacturer', 'manufacturer');

    // Apply filters
    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive });
    }

    if (search) {
      queryBuilder.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Apply pagination
    if (page && limit) {
      const skip = (page - 1) * limit;
      queryBuilder.skip(skip).take(limit);

      const [data, total] = await queryBuilder.getManyAndCount();

      return {
        data: this.transformUsersResponse(data),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    // Return all without pagination
    queryBuilder.orderBy('user.createdAt', 'DESC');
    const data = await queryBuilder.getMany();
    return this.transformUsersResponse(data);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['clinic', 'manufacturer'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  /**
   * Transform user entity to match frontend response format
   * Maps clinicName -> name and companyName -> name
   */
  transformUserResponse(user: User): any {
    const response: any = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phone: user.phone,
      whatsappNumber: user.whatsappNumber,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // Transform clinic to match frontend format (clinicName -> name)
    if (user.clinic) {
      response.clinic = {
        id: user.clinic.id,
        name: user.clinic.clinicName,
      };
    }

    // Transform manufacturer to match frontend format (companyName -> name)
    if (user.manufacturer) {
      response.manufacturer = {
        id: user.manufacturer.id,
        name: user.manufacturer.companyName,
      };
    }

    return response;
  }

  /**
   * Transform array of users to match frontend response format
   */
  private transformUsersResponse(users: User[]): any[] {
    return users.map((user) => this.transformUserResponse(user));
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      select: ['id', 'email', 'password', 'firstName', 'lastName', 'role', 'isActive'],
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.usersRepository.update(id, { lastLoginAt: new Date() });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    // Check email uniqueness if email is being updated
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.findByEmail(updateUserDto.email);
      if (existingUser) {
        throw new ConflictException('Email is already taken');
      }
    }

    // Update user fields
    if (updateUserDto.firstName !== undefined) {
      user.firstName = updateUserDto.firstName;
    }
    if (updateUserDto.lastName !== undefined) {
      user.lastName = updateUserDto.lastName;
    }
    if (updateUserDto.email !== undefined) {
      user.email = updateUserDto.email;
    }
    if (updateUserDto.role !== undefined) {
      user.role = updateUserDto.role;
    }
    if (updateUserDto.phone !== undefined) {
      user.phone = updateUserDto.phone;
    }
    if (updateUserDto.whatsappNumber !== undefined) {
      user.whatsappNumber = updateUserDto.whatsappNumber;
    }
    if (updateUserDto.isActive !== undefined) {
      user.isActive = updateUserDto.isActive;
    }

    // Handle organization updates if needed
    if (
      updateUserDto.organizationName &&
      (user.role === UserRole.CLINIC || user.role === UserRole.MANUFACTURER)
    ) {
      if (user.role === UserRole.CLINIC && user.clinic) {
        await this.clinicsService.update(user.clinic.id, {
          clinicName: updateUserDto.organizationName,
        });
      } else if (user.role === UserRole.MANUFACTURER && user.manufacturer) {
        // Note: Manufacturer entity uses companyName, not organizationName
        // This would need to be handled in manufacturers service
      }
    }

    await this.usersRepository.save(user);
    const updatedUser = await this.findOne(id);
    return this.transformUserResponse(updatedUser);
  }

  async toggleStatus(id: string, isActive: boolean): Promise<any> {
    const user = await this.findOne(id);
    user.isActive = isActive;
    await this.usersRepository.save(user);
    const updatedUser = await this.findOne(id);
    return this.transformUserResponse(updatedUser);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);

    // Check if user has active orders (if orders module is available)
    // For now, we'll allow deletion but this can be enhanced
    // TODO: Check for active orders before deletion

    const result = await this.usersRepository.softDelete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  /**
   * Update user profile (used by auth service for profile updates)
   * This method simply saves the user entity without additional validation
   */
  async updateProfile(user: User): Promise<User> {
    return this.usersRepository.save(user);
  }
}


