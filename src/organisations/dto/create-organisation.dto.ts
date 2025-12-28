import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  OrganisationType,
  OrganisationStatus,
  ApprovalStatus,
} from '../entities/organisation.entity';

export class CreateOrganisationDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsNotEmpty()
  @IsEnum(['AYURLAHI_TEAM', 'CLINIC', 'MANUFACTURER'])
  type: OrganisationType;

  @IsOptional()
  @IsEnum(['active', 'suspended', 'inactive'])
  status?: OrganisationStatus;

  // Clinic-specific fields
  @IsOptional()
  @IsString()
  @MaxLength(255)
  clinicName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  gstin?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pincode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsappNumber?: string;

  @IsOptional()
  socialMedia?: Record<string, any>;

  // Manufacturer-specific fields
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate?: number;
}

