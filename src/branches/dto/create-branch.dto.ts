import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEmail,
  IsUUID,
  IsEnum,
  MaxLength,
} from 'class-validator';
import {
  PatientVisibility,
  StaffPolicy,
} from '../../organisation-settings/entities/organisation-settings.entity';

export class CreateBranchDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsappNumber?: string;

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
  @IsUUID()
  managerId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  operatingHours?: Record<string, any>;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // ADR-004 D2/D5 — only read when this call creates the organisation's first
  // additional branch (existingCount === 0 in BranchesService.create()); every
  // later branch-creation call ignores these fields, since that code path
  // never runs again.
  @IsOptional()
  @IsEnum(PatientVisibility)
  patientVisibility?: PatientVisibility;

  @IsOptional()
  @IsEnum(StaffPolicy)
  staffPolicy?: StaffPolicy;
}


