import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

// Amendment: add a new line to an order that's still being packed (before
// PACKED — see scope/Order_Fulfillment_Lifecycle_Scope_2026-09-07.md §6).
// Same shape as one entry of CreateOrderDto.items -- reservation runs
// through the same cap-to-available logic as order creation.
export class AddOrderItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
