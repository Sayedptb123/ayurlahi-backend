import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { JwtPayload } from '../auth.service';
import { User } from '../../users/entities/user.entity';
import { OrganisationUser } from '../../organisation-users/entities/organisation-user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(OrganisationUser) private orgUsersRepository: Repository<OrganisationUser>,
  ) {
    const jwtSecret =
      configService.get<string>('JWT_SECRET') ||
      'your-secret-key-change-in-production';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    // Re-validate the user is still active on every authenticated request.
    // Without this, deactivating a user has no effect until their token
    // expires (could be hours).
    const user = await this.usersRepository.findOne({
      where: { id: payload.sub },
      select: ['id', 'isActive', 'deletedAt'] as any,
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    if (user.deletedAt) {
      throw new UnauthorizedException('User account has been deleted');
    }
    if (user.isActive === false) {
      throw new ForbiddenException('Your account has been deactivated. Contact support.');
    }

    // Also validate the org membership for the token's org context is still active
    if (payload.organisationId) {
      const orgUser = await this.orgUsersRepository.findOne({
        where: { userId: payload.sub, organisationId: payload.organisationId },
        select: ['id', 'isActive', 'deletedAt'] as any,
      });
      if (orgUser && (orgUser.deletedAt || orgUser.isActive === false)) {
        throw new ForbiddenException('Your access to this organisation has been revoked');
      }
    }

    return {
      userId: payload.sub,
      email: payload.email,
      organisationId: payload.organisationId,
      organisationType: payload.organisationType,
      role: payload.role,
    };
  }
}
