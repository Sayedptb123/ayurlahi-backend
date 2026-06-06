import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class LogBillPaymentDto {
  @IsDateString()
  @IsOptional()
  billPeriodStart?: string;

  @IsDateString()
  @IsOptional()
  billPeriodEnd?: string;

  @IsNumber()
  @Min(0)
  billAmount: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  billNumber?: string;

  @IsDateString()
  @IsOptional()
  billDate?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  billUrl?: string;

  @IsNumber()
  @Min(0)
  paidAmount: number;

  @IsDateString()
  paidDate: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  lateFee?: number;
}
