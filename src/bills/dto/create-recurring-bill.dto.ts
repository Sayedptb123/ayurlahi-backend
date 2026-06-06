import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsEnum,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { RecurringBillFrequency } from '../entities/recurring-bill.entity';

export class CreateRecurringBillDto {
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsString()
  category: string;

  @IsString()
  @MaxLength(255)
  billName: string;

  @IsString()
  @MaxLength(50)
  billType: string;

  @IsString()
  @MaxLength(255)
  vendorName: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  vendorAccountNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  vendorContact?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  estimatedAmount?: number;

  @IsEnum(RecurringBillFrequency)
  frequency: RecurringBillFrequency;

  @IsNumber()
  @Min(1)
  @Max(31)
  @IsOptional()
  dayOfMonth?: number;

  @IsNumber()
  @Min(1)
  @Max(7)
  @IsOptional()
  dayOfWeek?: number;

  @IsOptional()
  customPattern?: any;

  @IsBoolean()
  @IsOptional()
  autoCreateExpense?: boolean;

  @IsBoolean()
  @IsOptional()
  autoApprove?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  approvalThreshold?: number;

  @IsBoolean()
  @IsOptional()
  autoPay?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  paymentMethod?: string;

  @IsDateString()
  nextDueDate: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
