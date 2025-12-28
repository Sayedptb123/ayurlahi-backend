import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsEnum,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BillStatus } from '../entities/patient-bill.entity';

export class GetBillsDto {
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
  appointmentId?: string;

  @IsOptional()
  @IsEnum(BillStatus)
  status?: BillStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string; // Filter by date range

  @IsOptional()
  @IsDateString()
  endDate?: string; // Filter by date range
}
