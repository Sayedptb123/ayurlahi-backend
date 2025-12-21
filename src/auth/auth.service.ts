import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const { password: _, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(
      registerDto.password,
      parseInt(this.configService.get<string>('BCRYPT_ROUNDS', '10')),
    );

    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });

    const { password: _, ...result } = user;
    return result;
  }

  async refreshToken(userId: string) {
    console.log('[AuthService] refreshToken called for userId:', userId);
    
    try {
      const user = await this.usersService.findOne(userId);
      console.log('[AuthService] User retrieved:', {
        id: user?.id,
        email: user?.email,
        isActive: user?.isActive,
      });
      
      if (!user) {
        console.error('[AuthService] User not found:', userId);
        throw new UnauthorizedException('User not found or inactive');
      }
      
      if (!user.isActive) {
        console.error('[AuthService] User is inactive:', userId);
        throw new UnauthorizedException('User not found or inactive');
      }

      const payload = { email: user.email, sub: user.id, role: user.role };
      console.log('[AuthService] Creating new token with payload:', payload);
      
      const access_token = this.jwtService.sign(payload);
      console.log('[AuthService] New token generated successfully');
      
      const result = {
        access_token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      };
      
      console.log('[AuthService] Refresh token response prepared');
      return result;
    } catch (error) {
      console.error('[AuthService] refreshToken error:', error.message);
      console.error('[AuthService] Error stack:', error.stack);
      throw error;
    }
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.formatUserResponse(user);
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    // Get the current user
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent updating read-only fields
    if ('email' in updateProfileDto) {
      throw new BadRequestException('Email cannot be updated via this endpoint');
    }
    if ('role' in updateProfileDto) {
      throw new BadRequestException('Role cannot be updated via this endpoint');
    }
    if ('password' in updateProfileDto) {
      throw new BadRequestException(
        'Password cannot be updated via this endpoint. Use /auth/change-password instead.',
      );
    }
    if ('isActive' in updateProfileDto) {
      throw new BadRequestException(
        'Account status cannot be updated via this endpoint',
      );
    }

    // Update allowed fields
    if (updateProfileDto.firstName !== undefined) {
      user.firstName = updateProfileDto.firstName;
    }
    if (updateProfileDto.lastName !== undefined) {
      user.lastName = updateProfileDto.lastName;
    }
    if (updateProfileDto.phone !== undefined) {
      user.phone = updateProfileDto.phone ?? null;
    }
    if (updateProfileDto.whatsappNumber !== undefined) {
      user.whatsappNumber = updateProfileDto.whatsappNumber ?? null;
    }
    if (updateProfileDto.address !== undefined) {
      user.address = updateProfileDto.address;
    }

    // Save updated user
    const updatedUser = await this.usersService.updateProfile(user);

    return this.formatUserResponse(updatedUser);
  }

  /**
   * Format user response to match frontend expectations
   * Includes clinic/manufacturer transformation
   */
  private formatUserResponse(user: any) {
    const response: any = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phone: user.phone,
      whatsappNumber: user.whatsappNumber,
      address: user.address,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
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
}


