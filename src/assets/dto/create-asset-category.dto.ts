import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsEnum, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DepreciationMethod } from '../entities/asset-category.entity';

export class CreateAssetCategoryDto {
  @ApiProperty({ description: 'Name of the asset category (e.g. Medical Equipment)' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Code for the category (e.g. MED)', required: false })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ description: 'Annual depreciation rate in percentage (e.g. 10.5 for 10.5%)', required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  depreciationRate?: number;

  @ApiProperty({
    description: 'Depreciation calculation method',
    enum: DepreciationMethod,
    required: false,
    default: DepreciationMethod.STRAIGHT_LINE,
  })
  @IsEnum(DepreciationMethod)
  @IsOptional()
  depreciationMethod?: DepreciationMethod;

  @ApiProperty({ description: 'Whether this category is active', required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
