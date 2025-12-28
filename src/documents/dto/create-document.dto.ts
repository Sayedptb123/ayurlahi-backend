import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUUID,
  IsDateString,
  IsInt,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  DocumentRelatedType,
  DocumentCategory,
  AccessLevel,
} from '../entities/document.entity';

export class CreateDocumentDto {
  @IsNotEmpty()
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
  relatedType: DocumentRelatedType;

  @IsNotEmpty()
  @IsUUID()
  relatedId: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  fileName: string;

  @IsNotEmpty()
  @IsString()
  filePath: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  fileType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  fileExtension?: string;

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
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}
