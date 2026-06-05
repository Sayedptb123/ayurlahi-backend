import {
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleVisitDto {
  @IsOptional() @IsDateString() scheduledAt?: string;
  // Manager assigns; a field-staff caller defaults to themselves.
  @IsOptional() @IsUUID() assignedFieldStaffId?: string;
}

export class CheckInDto {
  @Type(() => Number) @IsNumber() latitude: number;
  @Type(() => Number) @IsNumber() longitude: number;
  // Offline: the real check-in moment, captured on arrival (not at sync) (B5).
  @IsOptional() @IsDateString() occurredAt?: string;
  @IsOptional() @IsBoolean() createdOffline?: boolean;
}

export class CheckOutDto {
  @IsOptional() @IsString() outcome?: string;
  @IsOptional() @IsBoolean() demoGiven?: boolean;
  @IsOptional() @IsString() metPersonName?: string;
  @IsOptional() @IsString() materialsLeft?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) photos?: string[];
  @IsOptional() @IsString() consentSignatureUrl?: string;
}
