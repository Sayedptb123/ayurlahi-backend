import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

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
    private jwtService: JwtService,
  ) {}

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
}
