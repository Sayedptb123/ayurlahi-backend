import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLeaveTypeDto {
  @ApiProperty({ description: 'Name of the leave type (e.g. Sick Leave)' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Code for the leave type (e.g. SL)', required: false })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ description: 'Maximum days allowed per year', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxDaysPerYear?: number;

  @ApiProperty({ description: 'Whether the leave is paid', required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;

  @ApiProperty({ description: 'Whether requests require approval', required: false, default: true })
  @IsBoolean()
  @IsOptional()
  requiresApproval?: boolean;

  @ApiProperty({ description: 'Whether remaining balance can carry forward', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  carryForward?: boolean;

  @ApiProperty({ description: 'Maximum carried forward days allowed', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxCarryForwardDays?: number;

  @ApiProperty({ description: 'Whether this leave type is active', required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
