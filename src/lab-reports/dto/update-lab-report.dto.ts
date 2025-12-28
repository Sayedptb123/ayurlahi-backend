import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
  IsUrl,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LabReportStatus } from '../entities/lab-report.entity';
import { LabTestDto } from './lab-test.dto';

export class UpdateLabReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reportNumber?: string;

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
  orderDate?: string;

  @IsOptional()
  @IsDateString()
  collectionDate?: string;

  @IsOptional()
  @IsDateString()
  reportDate?: string;

  @IsOptional()
  @IsEnum(LabReportStatus)
  status?: LabReportStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  reportFile?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabTestDto)
  tests?: LabTestDto[];
}
