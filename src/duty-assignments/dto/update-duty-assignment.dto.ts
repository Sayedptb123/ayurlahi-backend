import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import type { DutyStatus } from '../entities/duty-assignment.entity';

export class UpdateDutyAssignmentDto {
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsUUID()
  dutyTypeId?: string;

  @IsOptional()
  @IsDateString()
  dutyDate?: string;

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

  @IsOptional()
  @IsUUID()
  replacedByStaffId?: string;

  @IsOptional()
  @IsString()
  replacementReason?: string;
}


