import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';

export class CreateRefundDto {
  @IsString()
  paymentId: string;

  @IsNumber()
  @IsOptional()
  amount?: number; // Amount in paise, optional for full refund

  @IsString()
  @IsOptional()
  speed?: 'optimum' | 'normal'; // Refund speed

  @IsObject()
  @IsOptional()
  notes?: Record<string, string>;
}

