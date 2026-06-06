import { IsString, IsOptional, IsNumber, IsUUID, IsDateString, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AssetStatus } from '../entities/asset.entity';

export class UpdateAssetDto {
  @ApiProperty({ description: 'ID of the asset category', required: false })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ description: 'ID of the branch where the asset is located', required: false })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiProperty({ description: 'Unique code for tracking the asset', required: false })
  @IsString()
  @IsOptional()
  assetCode?: string;

  @ApiProperty({ description: 'Name/Title of the asset', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Detailed description of the asset', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Brand/Manufacturer of the asset', required: false })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiProperty({ description: 'Model identifier', required: false })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiProperty({ description: 'Serial number of the manufacturer', required: false })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiProperty({ description: 'Date when the asset was purchased (YYYY-MM-DD)', required: false })
  @IsDateString()
  @IsOptional()
  purchaseDate?: string;

  @ApiProperty({ description: 'Cost/Price of purchase', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  purchasePrice?: number;

  @ApiProperty({ description: 'Vendor who sold the asset', required: false })
  @IsString()
  @IsOptional()
  vendor?: string;

  @ApiProperty({ description: 'ID of the purchase order that bought this asset', required: false })
  @IsUUID()
  @IsOptional()
  purchaseOrderId?: string;

  @ApiProperty({ description: 'Physical room or location description', required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ description: 'ID of the staff member responsible for the asset', required: false })
  @IsUUID()
  @IsOptional()
  assignedToStaffId?: string;

  @ApiProperty({ description: 'Current status of the asset', enum: AssetStatus, required: false })
  @IsEnum(AssetStatus)
  @IsOptional()
  status?: AssetStatus;

  @ApiProperty({ description: 'Interval in days for recurring maintenance', required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maintenanceIntervalDays?: number;
}
