import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

export class CreateVitalDto {
  @ApiProperty({ description: 'Patient UUID' })
  @IsString()
  patientId: string;

  @ApiProperty({ description: 'ISO date-time when vitals were recorded' })
  @IsDateString()
  recordedAt: string;

  @ApiProperty({ description: 'Blood pressure reading, e.g. 120/80', required: false })
  @IsOptional()
  @IsString()
  bp?: string;

  @ApiProperty({ description: 'Body temperature in Celsius', required: false })
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @ApiProperty({ description: 'Pulse in beats per minute', required: false })
  @IsOptional()
  @IsNumber()
  pulse?: number;

  @ApiProperty({ description: 'SpO2 oxygen saturation percentage', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  spo2?: number;

  @ApiProperty({ description: 'Weight in kilograms', required: false })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiProperty({ description: 'Height in centimetres', required: false })
  @IsOptional()
  @IsNumber()
  height?: number;

  @ApiProperty({ description: 'Pain score 0-10', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  painScore?: number;

  @ApiProperty({ description: 'Additional notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
