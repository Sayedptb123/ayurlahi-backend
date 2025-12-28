import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';

export class PrescriptionItemDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  medicineName: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  dosage?: string; // e.g., "500mg"

  @IsOptional()
  @IsString()
  @MaxLength(100)
  frequency?: string; // e.g., "2 times a day"

  @IsOptional()
  @IsString()
  @MaxLength(100)
  duration?: string; // e.g., "7 days"

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
