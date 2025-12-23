import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsNumber,
  Min,
  IsArray,
  IsBoolean,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleDayDto {
  @IsOptional()
  @IsString()
  start?: string; // Format: "HH:mm" e.g., "09:00"

  @IsOptional()
  @IsString()
  end?: string; // Format: "HH:mm" e.g., "17:00"

  @IsOptional()
  @IsBoolean()
  available?: boolean;
}

export class ScheduleDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDayDto)
  monday?: ScheduleDayDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDayDto)
  tuesday?: ScheduleDayDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDayDto)
  wednesday?: ScheduleDayDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDayDto)
  thursday?: ScheduleDayDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDayDto)
  friday?: ScheduleDayDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDayDto)
  saturday?: ScheduleDayDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDayDto)
  sunday?: ScheduleDayDto;
}

export class CreateDoctorDto {
  @IsOptional()
  @IsString()
  @MaxLength(36)
  userId?: string; // Optional: link to existing user account

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  doctorId: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  firstName: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  lastName: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  specialization: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  qualification?: string[];

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  licenseNumber: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  consultationFee?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDto)
  schedule?: ScheduleDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

