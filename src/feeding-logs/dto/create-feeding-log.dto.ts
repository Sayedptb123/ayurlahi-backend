import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsIn,
  Min,
} from 'class-validator';

export class CreateFeedingLogDto {
  @ApiProperty({ description: 'Baby patient UUID' })
  @IsString()
  patientId: string;

  @ApiProperty({ description: 'Mother patient UUID', required: false })
  @IsOptional()
  @IsString()
  motherPatientId?: string;

  @ApiProperty({ description: 'ISO date-time of feeding event' })
  @IsDateString()
  feedingTime: string;

  @ApiProperty({
    description: 'Feeding type',
    enum: ['breastfeed', 'formula', 'both'],
  })
  @IsString()
  @IsIn(['breastfeed', 'formula', 'both'])
  feedingType: string;

  @ApiProperty({ description: 'Duration of feeding in minutes', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  durationMinutes?: number;

  @ApiProperty({ description: 'Quantity consumed in millilitres', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityMl?: number;

  @ApiProperty({ description: 'Additional notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
