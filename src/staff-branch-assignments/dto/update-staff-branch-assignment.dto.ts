import {
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsString,
} from 'class-validator';
import type { AssignmentType } from '../entities/staff-branch-assignment.entity';

export class UpdateStaffBranchAssignmentDto {
  @IsOptional()
  @IsDateString()
  assignedTo?: string;

  @IsOptional()
  @IsEnum(['permanent', 'temporary', 'rotating'])
  assignmentType?: AssignmentType;

  @IsOptional()
  @IsString()
  branchRole?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}


