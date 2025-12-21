import { IsNumber, IsString, IsOptional, IsObject } from 'class-validator';

export class TransferDto {
  @IsString()
  account: string; // Razorpay account ID

  @IsNumber()
  amount: number; // Amount in paise

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateOrderDto {
  @IsNumber()
  amount: number; // Amount in paise

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  receipt: string;

  @IsObject()
  @IsOptional()
  notes?: Record<string, string>;

  @IsObject()
  @IsOptional()
  splitPayment?: {
    transfers: TransferDto[];
  };
}





