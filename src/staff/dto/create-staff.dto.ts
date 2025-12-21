import {
  IsString,
  IsOptional,
  IsObject,
  IsEmail,
  IsDateString,
  IsNumber,
  IsArray,
  MinLength,
  MaxLength,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { StaffPosition } from '../../common/enums/staff-position.enum';
import { IsEnum } from 'class-validator';

class AddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (value === '' ? null : value))
  street?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (value === '' ? null : value))
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (value === '' ? null : value))
  state?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) => (value === '' ? null : value))
  zipCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (value === '' ? null : value))
  country?: string | null;
}

export class CreateStaffDto {
  @IsString()
  @MinLength(1, { message: 'First name must be at least 1 character' })
  @MaxLength(100, { message: 'First name must not exceed 100 characters' })
  firstName: string;

  @IsString()
  @MinLength(1, { message: 'Last name must be at least 1 character' })
  @MaxLength(100, { message: 'Last name must not exceed 100 characters' })
  lastName: string;

  @IsEnum(StaffPosition, { message: 'Invalid position' })
  position: StaffPosition;

  @ValidateIf((o) => o.position === StaffPosition.OTHER)
  @IsString()
  @MinLength(1, { message: 'Position custom is required when position is "other"' })
  @MaxLength(100, { message: 'Position custom must not exceed 100 characters' })
  positionCustom?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  @MaxLength(255, { message: 'Email must not exceed 255 characters' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Phone number must not exceed 20 characters' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'WhatsApp number must not exceed 20 characters' })
  whatsappNumber?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  @Transform(({ value }) => {
    if (!value) return null;
    const hasAnyValue = Object.values(value).some(
      (v) => v !== null && v !== undefined && v !== '',
    );
    return hasAnyValue ? value : null;
  })
  address?: AddressDto | null;

  @IsOptional()
  @IsDateString({}, { message: 'Invalid date format. Use YYYY-MM-DD' })
  dateOfBirth?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Invalid date format. Use YYYY-MM-DD' })
  dateOfJoining?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Salary must be a number' })
  @Min(0, { message: 'Salary must be non-negative' })
  @Type(() => Number)
  salary?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  qualifications?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Specialization must not exceed 255 characters' })
  specialization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Notes must not exceed 1000 characters' })
  notes?: string;
}


