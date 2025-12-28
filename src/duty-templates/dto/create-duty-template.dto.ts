import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsObject,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateDutyTemplateDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsNotEmpty()
  @IsObject()
  schedulePattern: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsObject()
  recurrencePattern?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

