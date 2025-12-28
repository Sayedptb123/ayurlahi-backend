import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateDutyTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsObject()
  schedulePattern?: Record<string, any>;

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

