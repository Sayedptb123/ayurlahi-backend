import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class MarkInvoicePaidDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  paidAmount?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
