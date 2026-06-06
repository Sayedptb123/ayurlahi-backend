import { IsNotEmpty, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AllocateLeaveBalanceDto {
  @ApiProperty({ description: 'ID of the staff member' })
  @IsUUID()
  @IsNotEmpty()
  staffId: string;

  @ApiProperty({ description: 'ID of the leave type' })
  @IsUUID()
  @IsNotEmpty()
  leaveTypeId: string;

  @ApiProperty({ description: 'Calendar year for the allocation (e.g. 2026)' })
  @IsNumber()
  @Min(2000)
  @IsNotEmpty()
  year: number;

  @ApiProperty({ description: 'Total number of allotted leave days' })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  totalAllotted: number;

  @ApiProperty({ description: 'Number of carried forward leave days', required: false, default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  carriedForward?: number;
}
