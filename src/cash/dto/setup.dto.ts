import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

// Cash Set-up (scope/Cash_Setup_Implementation_2026-09-25.md §5).
// In PATCH bodies, a field left out means "unchanged"; null clears it.

export class CreateLedgerDto {
  @IsIn(['cash', 'bank', 'upi', 'expense'])
  kind: 'cash' | 'bank' | 'upi' | 'expense';

  @IsString()
  @Length(2, 150)
  name: string;

  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsUUID()
  custodianUserId?: string | null;

  // Only after go-live: money already in a place added later (§6).
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingBalance?: number;
}

export class UpdateLedgerDto {
  @IsOptional()
  @IsString()
  @Length(2, 150)
  name?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsUUID()
  custodianUserId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreatePartnerDto {
  @IsString()
  @Length(2, 120)
  name: string;

  @IsOptional()
  @IsUUID()
  userId?: string | null;

  // Only after go-live: patient money this partner already holds (§6).
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingHeldBalance?: number;
}

export class UpdatePartnerDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Switching off a partner whose money in/out balance isn't zero (§4b).
  @IsOptional()
  @IsBoolean()
  confirmOutstandingBalance?: boolean;
}
