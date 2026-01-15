import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganisationUser } from '../../organisation-users/entities/organisation-user.entity';

@Injectable()
export class OrganisationGuard implements CanActivate {
  constructor(
    @InjectRepository(OrganisationUser)
    private readonly organisationUsersRepository: Repository<OrganisationUser>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const organisationId =
      request.params.organisationId || request.body.organisationId;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // If no organisationId in request, allow (might be user-level endpoint)
    if (!organisationId) {
      return true;
    }

    // Check if user has access to this organisation
    const orgUser = await this.organisationUsersRepository.findOne({
      where: {
        userId: user.userId,
        organisationId,
      },
    });

    if (!orgUser) {
      throw new ForbiddenException(
        'You do not have access to this organisation',
      );
    }

    // Add organisation context to request
    request.organisation = {
      id: organisationId,
      role: orgUser.role,
    };

    return true;
  }
}


