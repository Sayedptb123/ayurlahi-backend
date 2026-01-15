import { IsOptional, IsInt, IsEnum, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import type {
  OrganisationType,
  OrganisationStatus,
  ApprovalStatus,
} from '../entities/organisation.entity';

export class GetOrganisationsDto {
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
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(['AYURLAHI_TEAM', 'CLINIC', 'MANUFACTURER'])
  type?: OrganisationType;

  @IsOptional()
  @IsEnum(['active', 'suspended', 'inactive'])
  status?: OrganisationStatus;

  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected'])
  approvalStatus?: ApprovalStatus;
}


