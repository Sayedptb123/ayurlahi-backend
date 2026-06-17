import {
  IsNumber,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  Min,
} from 'class-validator';
import { PaymentMethod } from '../entities/patient-bill.entity';

export class PaymentDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  // The day the money was received. Defaults to today when omitted; may be
  // backdated by the receptionist for a payment that came in earlier.
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  // Cheque number / UPI transaction id / receipt number.
  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
