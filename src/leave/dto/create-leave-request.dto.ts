import { IsString, IsNotEmpty, IsOptional, IsNumber, IsUUID, IsDateString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLeaveRequestDto {
  @ApiProperty({ description: 'ID of the staff member applying for leave' })
  @IsUUID()
  @IsNotEmpty()
  staffId: string;

  @ApiProperty({ description: 'ID of the leave type being requested' })
  @IsUUID()
  @IsNotEmpty()
  leaveTypeId: string;

  @ApiProperty({ description: 'Start date of the leave (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ description: 'End date of the leave (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({ description: 'Total number of leave days requested (supports decimals for half-days)' })
  @IsNumber()
  @Min(0.5)
  @IsNotEmpty()
  totalDays: number;

  @ApiProperty({ description: 'Reason for requesting the leave', required: false })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({ description: 'ID of the staff member covering duties during absence', required: false })
  @IsUUID()
  @IsOptional()
  coveredByStaffId?: string;
}
