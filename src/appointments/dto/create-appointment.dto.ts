import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { AppointmentStatus, AppointmentType } from '../entities/appointment.entity';

export class CreateAppointmentDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(36)
  patientId: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(36)
  doctorId: string;

  @IsNotEmpty()
  @IsDateString()
  appointmentDate: string; // Format: "YYYY-MM-DD"

  @IsNotEmpty()
  @IsString()
  appointmentTime: string; // Format: "HH:mm" or "HH:mm:ss"

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480) // Max 8 hours
  duration?: number; // Duration in minutes, default 30

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @IsEnum(AppointmentType)
  appointmentType?: AppointmentType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}



