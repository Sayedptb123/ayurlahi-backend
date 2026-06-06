import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsEnum, IsBoolean, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MaintenanceType } from '../entities/asset-maintenance.entity';

export class LogMaintenanceDto {
  @ApiProperty({ description: 'Type of maintenance performed', enum: MaintenanceType })
  @IsEnum(MaintenanceType)
  @IsNotEmpty()
  maintenanceType: MaintenanceType;

  @ApiProperty({ description: 'Date of maintenance (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  maintenanceDate: string;

  @ApiProperty({ description: 'Cost of maintenance service', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  cost?: number;

  @ApiProperty({ description: 'Service provider / company name', required: false })
  @IsString()
  @IsOptional()
  serviceProvider?: string;

  @ApiProperty({ description: 'Description of actions taken', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Next scheduled maintenance date (optional, falls back to interval calculation)', required: false })
  @IsDateString()
  @IsOptional()
  nextMaintenanceDate?: string;

  @ApiProperty({ description: 'Whether to automatically record an expense entry in the finance ledger', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  integrateExpense?: boolean;
}
