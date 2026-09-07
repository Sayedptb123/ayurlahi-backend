import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderStatus } from '../entities/order.entity';

// Only read when status === PACKED. Lets the manufacturer's packing team
// record, per item, what was actually packed and any per-item discount --
// the mechanical inputs billing needs (see
// scope/Order_Fulfillment_Lifecycle_Scope_2026-09-07.md §7). This is not the
// packing UI (a later step) and not an amendment (which item/quantity is on
// the order at all -- also later): it only records the outcome of packing
// for items that already exist on the order.
export class PackedItemDto {
  @IsUUID()
  orderItemId: string;

  // Omit to default to the item's reservedQuantity (the common case: what
  // was reserved is what got packed). Validated against reservedQuantity in
  // the service, not here, since that requires loading the order.
  @IsOptional()
  @IsInt()
  @Min(0)
  packedQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackedItemDto)
  items?: PackedItemDto[];
}
