import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class OrganisationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const organisationId =
      request.params.organisationId || request.body.organisationId;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!organisationId) {
      return true;
    }

    if (user.organisationId !== organisationId) {
      throw new ForbiddenException(
        'You do not have access to this organisation',
      );
    }

    request.organisation = {
      id: organisationId,
      role: user.role,
    };

    return true;
  }
}
