import {
  IsString,
  IsOptional,
  IsObject,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

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

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'First name must be at least 1 character' })
  @MaxLength(100, { message: 'First name must not exceed 100 characters' })
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Last name must be at least 1 character' })
  @MaxLength(100, { message: 'Last name must not exceed 100 characters' })
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Phone number must not exceed 20 characters' })
  @Transform(({ value }) => {
    // Convert empty string to null
    if (value === '') return null;
    return value;
  })
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'WhatsApp number must not exceed 20 characters' })
  @Transform(({ value }) => {
    // Convert empty string to null
    if (value === '') return null;
    return value;
  })
  whatsappNumber?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  @Transform(({ value }) => {
    // If address is null or all fields are empty/null, return null
    if (!value) return null;
    const hasAnyValue = Object.values(value).some(
      (v) => v !== null && v !== undefined && v !== '',
    );
    return hasAnyValue ? value : null;
  })
  address?: AddressDto | null;
}

