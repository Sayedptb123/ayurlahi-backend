import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { LabTestStatus } from '../entities/lab-test.entity';

export class LabTestDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  testName: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  testCode?: string;

  @IsOptional()
  @IsString()
  result?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  normalRange?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @IsEnum(LabTestStatus)
  status?: LabTestStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}



