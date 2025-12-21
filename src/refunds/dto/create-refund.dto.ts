import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { RefundReason } from '../../common/enums/refund-reason.enum';

export class CreateRefundDto {
  @IsEnum(RefundReason)
  reason: RefundReason;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number; // Optional for full refund

  @IsOptional()
  @IsString()
  notes?: string;
}





