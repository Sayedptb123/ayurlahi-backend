import { IsOptional, IsInt, IsEnum, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum InvoiceStatus {
  PAID = 'paid',
  PENDING = 'pending',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export class GetInvoicesDto {
  // Branch switcher (clinic callers) — follows the invoice's order branch.
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  // So the packing/fulfillment UI can fetch "the invoice for this order"
  // directly instead of paging through every invoice client-side --
  // invoices.orderId is unique, so this returns at most one row.
  @IsOptional()
  @IsUUID()
  orderId?: string;
}
