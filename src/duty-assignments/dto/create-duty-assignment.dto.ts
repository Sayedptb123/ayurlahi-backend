import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  Matches,
} from 'class-validator';
import type { DutyStatus } from '../entities/duty-assignment.entity';

export class CreateDutyAssignmentDto {
  @IsNotEmpty()
  @IsUUID()
  branchId?: string;

  @IsNotEmpty()
  @IsUUID()
  staffId: string;

  @IsNotEmpty()
  @IsUUID()
  dutyTypeId: string;

  @IsNotEmpty()
  @IsDateString()
  dutyDate: string;

  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
    message: 'startTime must be in HH:MM:SS format',
  })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
    message: 'endTime must be in HH:MM:SS format',
  })
  endTime?: string;

  @IsOptional()
  @IsEnum(['scheduled', 'in_progress', 'completed', 'absent', 'cancelled'])
  status?: DutyStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

