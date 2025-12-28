import {
  IsOptional,
  IsInt,
  IsString,
  IsEnum,
  IsUUID,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  DocumentRelatedType,
  DocumentCategory,
} from '../entities/document.entity';

export class GetDocumentsDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum([
    'staff',
    'patient',
    'organisation',
    'expense',
    'purchase_order',
    'invoice',
    'prescription',
    'lab_report',
    'other',
  ])
  relatedType?: DocumentRelatedType;

  @IsOptional()
  @IsUUID()
  relatedId?: string;

  @IsOptional()
  @IsEnum([
    'cv',
    'biodata',
    'license',
    'certificate',
    'invoice',
    'receipt',
    'prescription',
    'lab_report',
    'medical_record',
    'identity',
    'other',
  ])
  category?: DocumentCategory;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isExpired?: boolean;
}
