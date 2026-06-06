import { IsString, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLeaveTypeDto {
  @ApiProperty({ description: 'Name of the leave type', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Code for the leave type', required: false })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ description: 'Maximum days allowed per year', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxDaysPerYear?: number;

  @ApiProperty({ description: 'Whether the leave is paid', required: false })
  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;

  @ApiProperty({ description: 'Whether requests require approval', required: false })
  @IsBoolean()
  @IsOptional()
  requiresApproval?: boolean;

  @ApiProperty({ description: 'Whether remaining balance can carry forward', required: false })
  @IsBoolean()
  @IsOptional()
  carryForward?: boolean;

  @ApiProperty({ description: 'Maximum carried forward days allowed', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxCarryForwardDays?: number;

  @ApiProperty({ description: 'Whether this leave type is active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
