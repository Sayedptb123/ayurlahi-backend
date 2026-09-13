import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// Post-PACKED Order Correction Workflow (scope/Post_PACKED_Correction_Workflow_Design_2026-09-13.md).
// Matches §8's reason picker exactly.
export const CORRECTION_REASONS = [
  'wrong_quantity',
  'wrong_item',
  'wrong_price',
  'wrong_discount',
  'other',
] as const;

export class CorrectOrderDto {
  @IsIn(CORRECTION_REASONS)
  reason: (typeof CORRECTION_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
