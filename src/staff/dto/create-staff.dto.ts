import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsEmail,
  IsDateString,
  IsNumber,
  Min,
  IsArray,
  MaxLength,
  ValidateIf,
  ValidateNested,
  IsBoolean,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  StaffPosition,
  isEmailRequiredForPosition,
} from '../entities/staff.entity';

export class AddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  zipCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;
}

export class CreateStaffDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  firstName: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  lastName: string;

  @IsNotEmpty()
  @IsEnum(StaffPosition)
  position: StaffPosition;

  @ValidateIf((o) => o.position === StaffPosition.OTHER)
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  positionCustom?: string;

  // Required for professional positions and when creating a login account;
  // optional for support roles (cook, helper, etc.). Always validated as a
  // proper email when a value is provided.
  @ValidateIf(
    (o) =>
      o.createUserAccount === true ||
      isEmailRequiredForPosition(o.position) ||
      (typeof o.email === 'string' && o.email.trim() !== ''),
  )
  @IsNotEmpty({ message: 'Email is required for professional staff' })
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsappNumber?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsDateString()
  dateOfJoining?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salary?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  qualifications?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  specialization?: string;

  // Doctor-specific fields (used when position === 'doctor')
  @IsOptional()
  @IsString()
  @MaxLength(50)
  doctorCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  licenseNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  consultationFee?: number;

  @IsOptional()
  schedule?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  // User account creation fields
  @IsOptional()
  @IsBoolean()
  createUserAccount?: boolean;

  @ValidateIf((o) => o.createUserAccount === true)
  @IsNotEmpty({ message: 'Password is required when creating user account' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(100)
  password?: string;
}
