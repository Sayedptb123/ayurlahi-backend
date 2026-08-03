import {
  IsOptional,
  IsString,
  IsInt,
  IsUUID,
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
  @IsString()
  @MaxLength(36)
  bookingId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  admissionId?: string;

  @IsOptional()
  @IsEnum(BillStatus)
  status?: BillStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string; // Filter by date range

  @IsOptional()
  @IsDateString()
  endDate?: string; // Filter by date range

  // Personal "which branch am I viewing" filter (branch switcher) — narrows
  // within whatever resolveVisibleBranchIds() already allows, never broadens it.
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
