import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  IsArray,
  Min,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BillStatus, PaymentMethod } from '../entities/patient-bill.entity';
import { BillItemDto } from './bill-item.dto';

export class CreateBillDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  billNumber?: string;

  // Optional — omit for a walk-in bill (see walkInName/walkInPhone). A
  // request must not send both patientId and walk-in fields; the service
  // rejects that combination rather than silently persisting contradictory
  // data. See scope/Walkin_Billing_Scope_2026-09-06.md.
  @IsOptional()
  @IsString()
  @MaxLength(36)
  patientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  walkInName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  walkInPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  appointmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  bookingId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  admissionId?: string;

  // ADR-004 D9. Omit for organisation-wide (NULL).
  @IsOptional()
  @IsString()
  @MaxLength(36)
  branchId?: string;

  @IsNotEmpty()
  @IsDateString()
  billDate: string; // Format: "YYYY-MM-DD"

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  @IsOptional()
  @IsEnum(BillStatus)
  status?: BillStatus;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillItemDto)
  items: BillItemDto[];
}
