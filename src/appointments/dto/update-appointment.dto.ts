import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import {
  AppointmentStatus,
  AppointmentType,
} from '../entities/appointment.entity';

export class UpdateAppointmentDto {
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
  appointmentDate?: string;

  @IsOptional()
  @IsString()
  appointmentTime?: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  duration?: number;

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

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancellationReason?: string;
}
