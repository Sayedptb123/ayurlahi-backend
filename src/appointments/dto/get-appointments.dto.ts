import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsEnum,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentStatus, AppointmentType } from '../entities/appointment.entity';

export class GetAppointmentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  patientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  doctorId?: string;

  @IsOptional()
  @IsDateString()
  appointmentDate?: string; // Filter by specific date

  @IsOptional()
  @IsDateString()
  startDate?: string; // Filter by date range

  @IsOptional()
  @IsDateString()
  endDate?: string; // Filter by date range

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @IsEnum(AppointmentType)
  appointmentType?: AppointmentType;
}



