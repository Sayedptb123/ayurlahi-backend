import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUUID,
  IsDateString,
} from 'class-validator';
import type { AssignmentType } from '../entities/staff-branch-assignment.entity';

export class CreateStaffBranchAssignmentDto {
  @IsNotEmpty()
  @IsUUID()
  branchId: string;

  @IsNotEmpty()
  @IsUUID()
  staffId: string;

  @IsOptional()
  @IsDateString()
  assignedFrom?: string;

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

