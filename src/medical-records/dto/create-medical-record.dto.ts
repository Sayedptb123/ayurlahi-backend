import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsNumber,
  IsArray,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class VitalsDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bloodPressure?: string; // e.g., "120/80"

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  pulse?: number;

  @IsOptional()
  @IsNumber()
  respiratoryRate?: number;

  @IsOptional()
  @IsNumber()
  weight?: number; // in kg

  @IsOptional()
  @IsNumber()
  height?: number; // in cm

  @IsOptional()
  @IsNumber()
  bmi?: number;

  @IsOptional()
  @IsNumber()
  oxygenSaturation?: number; // SpO2 percentage

  @IsOptional()
  @IsNumber()
  glucose?: number; // blood glucose level
}

export class CreateMedicalRecordDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(36)
  patientId: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  appointmentId?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(36)
  doctorId: string;

  @IsNotEmpty()
  @IsDateString()
  visitDate: string; // Format: "YYYY-MM-DD"

  @IsNotEmpty()
  @IsString()
  chiefComplaint: string;

  @IsNotEmpty()
  @IsString()
  diagnosis: string;

  @IsNotEmpty()
  @IsString()
  treatment: string;

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
  attachments?: string[]; // Array of file URLs
}



