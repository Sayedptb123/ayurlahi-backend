import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';

export class CreatePaymentDto {
  @IsNumber()
  amount: number; // Amount in paise

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  orderId: string;

  @IsString()
  method: string; // 'card', 'netbanking', 'upi', 'wallet', etc.

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsObject()
  @IsOptional()
  notes?: Record<string, string>;
}

