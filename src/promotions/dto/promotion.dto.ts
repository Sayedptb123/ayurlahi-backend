import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsObject,
  IsArray,
  IsDateString,
  Min,
} from 'class-validator';
import { PromotionPlacement } from '../entities/promotion.entity';

export class CreatePromotionDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsEnum(PromotionPlacement)
  placement: PromotionPlacement;

  // { audience?: 'all'|'clinics'|'manufacturers', orgIds?: string[] }
  @IsObject()
  @IsOptional()
  targetingCriteria?: Record<string, any>;

  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @IsDateString()
  @IsOptional()
  endsAt?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdatePromotionDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsEnum(PromotionPlacement)
  @IsOptional()
  placement?: PromotionPlacement;

  @IsObject()
  @IsOptional()
  targetingCriteria?: Record<string, any>;

  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @IsDateString()
  @IsOptional()
  endsAt?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
