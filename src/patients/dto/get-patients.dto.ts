import { IsOptional, IsString, IsInt, IsUUID, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class GetPatientsDto {
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
  @MaxLength(100)
  search?: string; // Search by name, patientId, phone, email

  @IsOptional()
  @IsString()
  @MaxLength(10)
  bloodGroup?: string;

  // Personal "which branch am I viewing" filter (branch switcher) — narrows
  // within whatever resolveVisibleBranchIds() already allows, never broadens it.
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
