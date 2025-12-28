import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import type { OrganisationUserRole } from '../entities/organisation-user.entity';

export class UpdateOrganisationUserDto {
  @IsOptional()
  @IsEnum(['SUPER_ADMIN', 'SUPPORT', 'OWNER', 'MANAGER', 'STAFF'])
  role?: OrganisationUserRole;

  @IsOptional()
  permissions?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

