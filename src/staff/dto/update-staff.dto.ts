import {
  IsString,
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
} from 'class-validator';
import { Type } from 'class-transformer';
import { StaffPosition } from '../entities/staff.entity';
import { AddressDto } from './create-staff.dto';

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsEnum(StaffPosition)
  position?: StaffPosition;

  @ValidateIf((o) => o.position === StaffPosition.OTHER)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  positionCustom?: string;

  @IsOptional()
  @IsEmail()
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

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
