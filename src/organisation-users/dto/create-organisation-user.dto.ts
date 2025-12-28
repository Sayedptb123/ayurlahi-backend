import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import type { OrganisationUserRole } from '../entities/organisation-user.entity';

export class CreateOrganisationUserDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsNotEmpty()
  @IsUUID()
  organisationId: string;

  @IsNotEmpty()
  @IsEnum(['SUPER_ADMIN', 'SUPPORT', 'OWNER', 'MANAGER', 'STAFF'])
  role: OrganisationUserRole;

  @IsOptional()
  permissions?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

