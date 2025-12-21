import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '../../common/enums/role.enum';

@Injectable()
export class OrganizationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Only clinic and manufacturer users can access staff endpoints
    if (
      user.role !== UserRole.CLINIC &&
      user.role !== UserRole.MANUFACTURER
    ) {
      throw new ForbiddenException(
        'Only clinic and manufacturer users can manage staff',
      );
    }

    return true;
  }
}


