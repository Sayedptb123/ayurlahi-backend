import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsArray,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VitalsDto } from './create-medical-record.dto';

export class UpdateMedicalRecordDto {
  @IsOptional()
  @IsString()
  @MaxLength(36)
  patientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  appointmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  doctorId?: string;

  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  treatment?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => VitalsDto)
  vitals?: VitalsDto;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  attachments?: string[];
}
