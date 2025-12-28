import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsInt,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  DocumentCategory,
  AccessLevel,
} from '../entities/document.entity';

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

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
  @IsString()
  @MaxLength(50)
  subcategory?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  tags?: string[];

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsEnum(['public', 'internal', 'private'])
  accessLevel?: AccessLevel;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
