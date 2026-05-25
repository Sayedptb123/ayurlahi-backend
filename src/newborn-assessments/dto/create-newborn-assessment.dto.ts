import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsIn,
  Min,
  Max,
} from 'class-validator';

export class CreateNewbornAssessmentDto {
  @ApiProperty({ description: 'Baby patient UUID' })
  @IsString()
  patientId: string;

  @ApiProperty({ description: 'ISO date-time of assessment' })
  @IsDateString()
  assessmentTime: string;

  @ApiProperty({
    description: 'Type of assessment',
    enum: ['apgar_1min', 'apgar_5min', 'apgar_10min', 'general'],
  })
  @IsString()
  @IsIn(['apgar_1min', 'apgar_5min', 'apgar_10min', 'general'])
  assessmentType: string;

  @ApiProperty({ description: 'APGAR appearance (skin colour) score 0-2', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  appearance?: number;

  @ApiProperty({ description: 'APGAR pulse (heart rate) score 0-2', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  pulse?: number;

  @ApiProperty({ description: 'APGAR grimace (reflex irritability) score 0-2', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  grimace?: number;

  @ApiProperty({ description: 'APGAR activity (muscle tone) score 0-2', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  activity?: number;

  @ApiProperty({ description: 'APGAR respiration (breathing effort) score 0-2', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  respiration?: number;

  @ApiProperty({ description: 'APGAR total score (0-10); stored explicitly', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  apgarTotal?: number;

  @ApiProperty({ description: 'Birth weight in grams', required: false })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiProperty({ description: 'Length in centimetres', required: false })
  @IsOptional()
  @IsNumber()
  length?: number;

  @ApiProperty({ description: 'Head circumference in centimetres', required: false })
  @IsOptional()
  @IsNumber()
  headCircumference?: number;

  @ApiProperty({
    description: 'Jaundice severity level',
    enum: ['none', 'mild', 'moderate', 'severe'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['none', 'mild', 'moderate', 'severe'])
  jaundiceLevel?: string;

  @ApiProperty({ description: 'Additional notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
