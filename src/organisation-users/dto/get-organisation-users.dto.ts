import { IsOptional, IsInt, IsEnum, IsUUID, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import type { OrganisationUserRole } from '../entities/organisation-user.entity';

export class GetOrganisationUsersDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  organisationId?: string;

  @IsOptional()
  @IsEnum(['SUPER_ADMIN', 'SUPPORT', 'OWNER', 'MANAGER', 'STAFF'])
  role?: OrganisationUserRole;
}


