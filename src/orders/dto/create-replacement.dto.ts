import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { ReplacementReason } from '../entities/order-replacement.entity';

// Post-delivery discrepancy report — missing/wrong/damaged item. Always a
// $0 correction against the original order, never a new order/invoice. See
// scope/Order_Fulfillment_Lifecycle_Scope_2026-09-07.md §9.
export class CreateReplacementDto {
  @IsUUID()
  orderItemId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsEnum(ReplacementReason)
  reason: ReplacementReason;

  // Optional link back to a human-facing case already raised in `disputes`
  // -- the two are deliberately separate shapes of data (see
  // order-replacement.entity.ts), not merged into one.
  @IsOptional()
  @IsUUID()
  disputeId?: string;
}
