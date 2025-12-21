import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    const secret = configService.get<string>('JWT_SECRET') || 'default-secret-change-in-production';
    console.log('[JwtRefreshStrategy] Initializing with secret:', secret ? 'Present' : 'Missing');
    console.log('[JwtRefreshStrategy] Secret length:', secret?.length || 0);
    
    // Custom extractor with logging
    const extractToken = (request: Request) => {
      const authHeader = request.headers.authorization;
      console.log('[JwtRefreshStrategy] Extracting token from request');
      console.log('[JwtRefreshStrategy] Auth header exists:', !!authHeader);
      
      if (!authHeader) {
        console.error('[JwtRefreshStrategy] ❌ No Authorization header found');
        return null;
      }
      
      if (!authHeader.startsWith('Bearer ')) {
        console.error('[JwtRefreshStrategy] ❌ Token missing "Bearer " prefix');
        console.error('[JwtRefreshStrategy] Header value:', authHeader);
        return null;
      }
      
      const token = authHeader.substring(7).trim(); // Remove "Bearer " and trim
      console.log('[JwtRefreshStrategy] Token extracted, length:', token.length);
      console.log('[JwtRefreshStrategy] Token value:', token === 'undefined' ? 'LITERAL STRING "undefined"' : token.substring(0, 30) + '...');
      
      // Check for common issues
      if (!token || token === 'undefined' || token === 'null' || token === '') {
        console.error('[JwtRefreshStrategy] ❌ Token is empty, undefined, or null string');
        console.error('[JwtRefreshStrategy] This is a FRONTEND issue - token not being sent correctly');
        return null;
      }
      
      // Validate JWT format (should have 3 parts: header.payload.signature)
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error('[JwtRefreshStrategy] ❌ Invalid JWT format - expected 3 parts, got:', parts.length);
        console.error('[JwtRefreshStrategy] Token value:', token);
        return null;
      }
      
      console.log('[JwtRefreshStrategy] ✅ Token format valid');
      return token;
    };
    
    super({
      jwtFromRequest: extractToken,
      ignoreExpiration: true, // Allow expired tokens for refresh
      secretOrKey: secret,
    });
    
    console.log('[JwtRefreshStrategy] Strategy initialized');
  }

  async validate(payload: any) {
    console.log('[JwtRefreshStrategy] validate called');
    console.log('[JwtRefreshStrategy] Token payload:', {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      exp: payload.exp,
      iat: payload.iat,
    });
    
    try {
      const user = await this.usersService.findOne(payload.sub);
      console.log('[JwtRefreshStrategy] User found:', {
        id: user?.id,
        email: user?.email,
        isActive: user?.isActive,
      });
      
      if (!user) {
        console.error('[JwtRefreshStrategy] User not found for ID:', payload.sub);
        throw new UnauthorizedException('User not found');
      }
      
      if (!user.isActive) {
        console.error('[JwtRefreshStrategy] User is inactive:', payload.sub);
        throw new UnauthorizedException('User is inactive');
      }
      
      console.log('[JwtRefreshStrategy] Validation successful');
      return user;
    } catch (error) {
      console.error('[JwtRefreshStrategy] Validation error:', error.message);
      throw error;
    }
  }
}

