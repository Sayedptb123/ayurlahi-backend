import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GetMedicalRecordsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  patientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  doctorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  appointmentId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string; // Filter by date range

  @IsOptional()
  @IsDateString()
  endDate?: string; // Filter by date range
}



