import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    try {
      // Use raw query with explicit column names matching the database schema
      const result = await this.usersRepository.query(
        `SELECT id, email, password, "firstName", "lastName", role, phone, "isActive", "isEmailVerified", "whatsappNumber", "lastLoginAt", "clinicId", "manufacturerId", "createdAt", "updatedAt" 
         FROM users 
         WHERE email = $1 
         LIMIT 1`,
        [email],
      );

      if (!result || result.length === 0 || !result[0].password) {
        return null;
      }

    const userData = result[0];
    const isPasswordValid = await bcrypt.compare(password, userData.password);

    if (!isPasswordValid) {
      return null;
    }

    // Map to User entity
    return {
      id: userData.id,
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      phone: userData.phone,
      isActive: userData.isActive,
      isEmailVerified: userData.isEmailVerified,
      whatsappNumber: userData.whatsappNumber,
      lastLoginAt: userData.lastLoginAt,
      clinicId: userData.clinicId,
      manufacturerId: userData.manufacturerId,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
    } as User;
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
        // Log error but don't fail login if lastLoginAt update fails
        console.error('Error updating lastLoginAt:', error);
      }

      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };

      // Debug: Log JWT secret being used
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
      console.log('[Auth Service] Login - JWT Secret check:', {
        hasSecret: !!process.env.JWT_SECRET,
        secretLength: jwtSecret.length,
        secretPreview: jwtSecret.substring(0, 10) + '...',
      });

      const accessToken = this.jwtService.sign(payload);
      
      // Debug: Log token details
      console.log('[Auth Service] Login - Token generated:', {
        tokenLength: accessToken.length,
        tokenPreview: accessToken.substring(0, 50) + '...',
        payload,
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          clinicId: user.clinicId,
          manufacturerId: user.manufacturerId,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async register(registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.usersRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user
    const user = this.usersRepository.create({
      email: registerDto.email,
      password: hashedPassword,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      role: registerDto.role,
      phone: registerDto.phone,
      isActive: true,
      isEmailVerified: false,
    });

    const savedUser = await this.usersRepository.save(user);

    const payload: JwtPayload = {
      sub: savedUser.id,
      email: savedUser.email,
      role: savedUser.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        role: savedUser.role,
        clinicId: savedUser.clinicId,
        manufacturerId: savedUser.manufacturerId,
        isActive: savedUser.isActive,
        isEmailVerified: savedUser.isEmailVerified,
      },
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      clinicId: user.clinicId,
      manufacturerId: user.manufacturerId,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      console.log('[Auth Service] Refresh token - Starting verification:', {
        refreshTokenLength: refreshToken?.length,
        refreshTokenPreview: refreshToken ? refreshToken.substring(0, 30) + '...' : 'missing',
        jwtSecret: process.env.JWT_SECRET ? process.env.JWT_SECRET.substring(0, 10) + '...' : 'using default',
      });
      
      // Verify the refresh token (in a real implementation, you'd use a separate refresh token secret)
      // For now, we'll verify it as a regular JWT token
      const payload = this.jwtService.verify(refreshToken);
      
      console.log('[Auth Service] Refresh token - Verification successful:', {
        payload,
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      });
      
      // Get user from database
      const user = await this.usersRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      // Generate new access token
      const newPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = this.jwtService.sign(newPayload);

      // Return new tokens (using same refresh token for simplicity)
      // In production, you might want to rotate refresh tokens
      return {
        accessToken,
        refreshToken: refreshToken, // Return same token or generate new one
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          clinicId: user.clinicId,
          manufacturerId: user.manufacturerId,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
        },
      };
    } catch (error) {
      console.error('[Auth Service] Refresh token - Verification failed:', {
        errorMessage: error?.message,
        errorName: error?.name,
        errorStack: error?.stack,
        refreshTokenLength: refreshToken?.length,
        refreshTokenPreview: refreshToken ? refreshToken.substring(0, 30) + '...' : 'missing',
      });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}

