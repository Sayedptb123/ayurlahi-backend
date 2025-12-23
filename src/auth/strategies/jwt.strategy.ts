import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_SECRET') || 'your-secret-key-change-in-production';
    
    // Debug: Log JWT secret being used for validation
    console.log('[JWT Strategy] Initializing with secret:', {
      hasSecret: !!configService.get<string>('JWT_SECRET'),
      secretLength: jwtSecret.length,
      secretPreview: jwtSecret.substring(0, 10) + '...',
    });
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    console.log('[JWT Strategy] Validating token payload:', {
      hasSub: !!payload.sub,
      hasEmail: !!payload.email,
      hasRole: !!payload.role,
      payload,
    });

    if (!payload.sub) {
      console.error('[JWT Strategy] Validation failed: Missing sub (userId)');
      throw new UnauthorizedException('Invalid token');
    }

    console.log('[JWT Strategy] Token validated successfully:', {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    });

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}

