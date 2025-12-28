import {
  IsString,
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
import { ScheduleDto } from './create-doctor.dto';

export class UpdateDoctorDto {
  @IsOptional()
  @IsString()
  @MaxLength(36)
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  doctorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  specialization?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  qualification?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  licenseNumber?: string;

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
