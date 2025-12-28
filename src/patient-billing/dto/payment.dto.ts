import {
  IsNumber,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsString,
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

  @IsOptional()
  @IsString()
  notes?: string;
}
