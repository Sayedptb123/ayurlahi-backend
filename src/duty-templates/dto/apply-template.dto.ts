import { IsNotEmpty, IsDateString, IsOptional } from 'class-validator';

export class ApplyTemplateDto {
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}


