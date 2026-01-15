import { IsOptional, IsInt, IsEnum, IsUUID, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import type { AssignmentType } from '../entities/staff-branch-assignment.entity';

export class GetStaffBranchAssignmentsDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsEnum(['permanent', 'temporary', 'rotating'])
  assignmentType?: AssignmentType;

  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;
}


