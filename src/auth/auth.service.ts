import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { Staff } from '../staff/entities/staff.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterOrganisationDto } from './dto/register-organisation.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { NotificationsService } from '../notifications/notifications.service';

export interface JwtPayload {
  sub: string; // userId
  email: string | null;
  organisationId?: string; // Current organisation context
  organisationType?: string; // Type of current organisation (CLINIC, MANUFACTURER, AYURLAHI_TEAM)
  role?: string; // Role in current organisation
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(OrganisationUser)
    private organisationUsersRepository: Repository<OrganisationUser>,
    @InjectRepository(Organisation)
    private organisationsRepository: Repository<Organisation>,
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
  ) { }

  async validateUser(email: string, password: string): Promise<User | null> {
    try {
      // Find user by email (email is optional, so also check phone if needed)
      const user = await this.usersRepository.findOne({
        where: { email },
      });

      if (!user) {
        console.log('[AuthService] validateUser - User not found:', email);
        return null;
      }

      if (!user.passwordHash) {
        console.log(
          '[AuthService] validateUser - No password hash found for user:',
          email,
        );
        return null;
      }

      console.log('[AuthService] validateUser - User found:', {
        email: user.email,
        hasPasswordHash: !!user.passwordHash,
        isActive: user.isActive,
      });

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

      console.log('[AuthService] validateUser - Password comparison result:', {
        email,
        isValid: isPasswordValid,
      });

      if (!isPasswordValid) {
        console.log(
          '[AuthService] validateUser - Password mismatch for user:',
          email,
        );
        return null;
      }

      return user;
    } catch (error) {
      console.error('validateUser error:', error);
      throw error;
    }
  }

  async login(loginDto: LoginDto) {
    try {
      const user = await this.validateUser(loginDto.email, loginDto.password);

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Account is inactive');
      }

      // Update last login
      try {
        user.lastLoginAt = new Date();
        await this.usersRepository.save(user);
      } catch (error) {
        console.error('Error updating lastLoginAt:', error);
      }

      // Fetch user's organisations
      const organisationUsers = await this.organisationUsersRepository.find({
        where: { userId: user.id },
        relations: ['organisation'],
      });

      // Get primary organisation or first organisation
      const primaryOrg = organisationUsers.find((ou) => ou.isPrimary);
      const currentOrg = primaryOrg || organisationUsers[0];

      // Block login for deactivated orgs (clinics & manufacturers only)
      if (
        currentOrg &&
        (currentOrg.organisation.type === 'CLINIC' || currentOrg.organisation.type === 'MANUFACTURER') &&
        currentOrg.organisation.isActive === false
      ) {
        throw new ForbiddenException('Your organisation account has been deactivated. Contact support@ayurlahi.com');
      }

      // Build organisations list for response
      const organisations = organisationUsers.map((ou) => ({
        id: ou.organisation.id,
        name: ou.organisation.name,
        type: ou.organisation.type,
        role: ou.role,
        isPrimary: ou.isPrimary,
      }));

      // JWT payload with current organisation context
      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        organisationId: currentOrg?.organisation.id,
        organisationType: currentOrg?.organisation.type,
        role: currentOrg?.role,
      };

      const accessToken = this.jwtService.sign(payload);

      console.log('[Auth Service] Login - Token generated:', {
        userId: user.id,
        email: user.email,
        organisationId: payload.organisationId,
        role: payload.role,
        organisationsCount: organisations.length,
      });

      return {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
        },
        currentOrganisation: currentOrg
          ? {
            id: currentOrg.organisation.id,
            name: currentOrg.organisation.name,
            type: currentOrg.organisation.type,
            role: currentOrg.role,
            approvalStatus: currentOrg.organisation.approvalStatus,
            isActive: currentOrg.organisation.isActive,
            permissions: currentOrg.permissions ?? null,
          }
          : null,
        organisations,
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async register(registerDto: RegisterDto) {
    // Phone is required in the new structure
    if (!registerDto.phone) {
      throw new BadRequestException('Phone number is required');
    }

    // Check if user already exists
    const existingUser = await this.usersRepository.findOne({
      where: [{ email: registerDto.email }, { phone: registerDto.phone }],
    });

    if (existingUser) {
      throw new ConflictException(
        'User with this email or phone already exists',
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user (no role, clinicId, manufacturerId - those are in organisation_users)
    const user = this.usersRepository.create({
      email: registerDto.email || null,
      passwordHash: hashedPassword,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      phone: registerDto.phone,
      isActive: true,
      isEmailVerified: false,
    });

    const savedUser = await this.usersRepository.save(user);

    // Note: Organisation assignment should be done separately
    // For clinic/manufacturer registration, they need to create organisation first
    // Then link user to organisation via organisation_users

    return {
      accessToken: null, // No token until organisation is assigned
      user: {
        id: savedUser.id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        phone: savedUser.phone,
        isActive: savedUser.isActive,
        isEmailVerified: savedUser.isEmailVerified,
      },
      message:
        'User registered successfully. Please complete organisation registration.',
    };
  }

  async registerOrganisation(dto: RegisterOrganisationDto) {
    // Check for existing user
    const existing = await this.usersRepository.findOne({
      where: [{ email: dto.email }, { phone: dto.phone }],
    });
    if (existing) {
      throw new ConflictException('An account with this email or phone already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = this.usersRepository.create({
      email: dto.email,
      passwordHash: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      isActive: true,
      isEmailVerified: false,
    });
    const savedUser = await this.usersRepository.save(user);

    // Create organisation (pending approval)
    const org = this.organisationsRepository.create({
      name: dto.orgName,
      type: dto.orgType,
      approvalStatus: 'pending',
      isActive: true,
    });
    const savedOrg = await this.organisationsRepository.save(org);

    // Link user to org as OWNER
    const orgUser = this.organisationUsersRepository.create({
      userId: savedUser.id,
      organisationId: savedOrg.id,
      role: 'OWNER',
      isPrimary: true,
    });
    await this.organisationUsersRepository.save(orgUser);

    // Notify all SUPER_ADMIN / SUPPORT users in AYURLAHI_TEAM
    this.notificationsService.getAdminUserIds().then((adminIds) => {
      if (adminIds.length > 0) {
        return this.notificationsService.sendToUsers({
          userIds: adminIds,
          title: '🔔 New Organisation Request',
          body: `${savedOrg.name} has submitted an application for review.`,
          data: { type: 'new_org_request', organisationId: savedOrg.id },
        });
      }
    }).catch((err) => console.error('[registerOrganisation] admin notify error:', err));

    // Issue token so user can see pending screen without logging in again
    const payload: JwtPayload = {
      sub: savedUser.id,
      email: savedUser.email,
      organisationId: savedOrg.id,
      organisationType: savedOrg.type,
      role: 'OWNER',
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        phone: savedUser.phone,
        isActive: savedUser.isActive,
        isEmailVerified: savedUser.isEmailVerified,
      },
      currentOrganisation: {
        id: savedOrg.id,
        name: savedOrg.name,
        type: savedOrg.type,
        role: 'OWNER' as const,
        approvalStatus: savedOrg.approvalStatus,
        isActive: savedOrg.isActive,
        permissions: null,
      },
    };
  }

  async getCurrentUser(userId: string, organisationId?: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Fetch user's organisations
    const organisationUsers = await this.organisationUsersRepository.find({
      where: { userId },
      relations: ['organisation'],
    });

    // Get current organisation context
    const currentOrgUser = organisationId
      ? organisationUsers.find((ou) => ou.organisationId === organisationId)
      : organisationUsers.find((ou) => ou.isPrimary) || organisationUsers[0];

    const organisations = organisationUsers.map((ou) => ({
      id: ou.organisation.id,
      name: ou.organisation.name,
      type: ou.organisation.type,
      role: ou.role,
      isPrimary: ou.isPrimary,
    }));

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      currentOrganisation: currentOrgUser
        ? {
          id: currentOrgUser.organisation.id,
          name: currentOrgUser.organisation.name,
          type: currentOrgUser.organisation.type,
          role: currentOrgUser.role,
          approvalStatus: currentOrgUser.organisation.approvalStatus,
          isActive: currentOrgUser.organisation.isActive,
          permissions: currentOrgUser.permissions ?? null,
        }
        : null,
      organisations,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      // Verify the refresh token
      const payload = this.jwtService.verify(refreshToken);

      // Get user from database
      const user = await this.usersRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      // Fetch user's organisations
      const organisationUsers = await this.organisationUsersRepository.find({
        where: { userId: user.id },
        relations: ['organisation'],
      });

      // Use organisation from token or get primary
      const currentOrg =
        organisationUsers.find(
          (ou) => ou.organisationId === payload.organisationId,
        ) ||
        organisationUsers.find((ou) => ou.isPrimary) ||
        organisationUsers[0];

      // Generate new access token
      const newPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        organisationId: currentOrg?.organisation.id,
        organisationType: currentOrg?.organisation.type,
        role: currentOrg?.role,
      };

      const accessToken = this.jwtService.sign(newPayload);

      const organisations = organisationUsers.map((ou) => ({
        id: ou.organisation.id,
        name: ou.organisation.name,
        type: ou.organisation.type,
        role: ou.role,
        isPrimary: ou.isPrimary,
      }));

      return {
        accessToken,
        refreshToken: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
        },
        currentOrganisation: currentOrg
          ? {
            id: currentOrg.organisation.id,
            name: currentOrg.organisation.name,
            type: currentOrg.organisation.type,
            role: currentOrg.role,
            approvalStatus: currentOrg.organisation.approvalStatus,
            isActive: currentOrg.organisation.isActive,
            permissions: currentOrg.permissions ?? null,
          }
          : null,
        organisations,
      };
    } catch (error) {
      console.error(
        '[Auth Service] Refresh token - Verification failed:',
        error,
      );
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async switchOrganisation(userId: string, organisationId: string) {
    // Verify user has access to this organisation
    const orgUser = await this.organisationUsersRepository.findOne({
      where: { userId, organisationId },
      relations: ['organisation'],
    });

    if (!orgUser) {
      throw new UnauthorizedException(
        'User does not have access to this organisation',
      );
    }

    // Get user
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate new token with new organisation context
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organisationId: orgUser.organisation.id,
      organisationType: orgUser.organisation.type,
      role: orgUser.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      organisation: {
        id: orgUser.organisation.id,
        name: orgUser.organisation.name,
        type: orgUser.organisation.type,
        role: orgUser.role,
      },
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Current password is required to set a new password');
      }
      if (!user.passwordHash) {
        throw new BadRequestException('No password set on this account');
      }
      const match = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!match) {
        throw new BadRequestException('Current password is incorrect');
      }
      user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phone !== undefined) user.phone = dto.phone;
    await this.usersRepository.save(user);

    // Keep staff record in sync
    const staffRecord = await this.staffRepository.findOne({ where: { userId: userId } });
    if (staffRecord) {
      if (dto.firstName !== undefined) staffRecord.firstName = dto.firstName;
      if (dto.lastName !== undefined) staffRecord.lastName = dto.lastName;
      if (dto.phone !== undefined) staffRecord.phone = dto.phone;
      await this.staffRepository.save(staffRecord);
    }

    const { passwordHash, ...result } = user as any;
    return result;
  }
}
