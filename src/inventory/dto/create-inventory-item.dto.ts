import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateInventoryItemDto {
  // ADR-005 Step 3 -- only meaningful for a per-branch org (see
  // BranchVisibilityService.resolveBranchIdForWrite); ignored for every
  // org still on the default 'shared' inventory policy, which today means
  // every org (PMS included -- flipping it is deferred to Step 4). Kept as
  // one flat DTO rather than split into item-master/branch-stock request
  // bodies, since the existing frontend sends one flat object and isn't
  // being changed in this step.
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  // Optional link to a marketplace products(id). null clears the link.
  @IsOptional()
  @IsUUID()
  productId?: string | null;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  // ISO date string (YYYY-MM-DD)
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  hsnCode?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  gstRate?: number;

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  currentStock?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  minStockLevel?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  unitPrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  costPrice?: number;
}

export class UpdateInventoryItemDto {
  // ADR-005 Step 3 -- same as CreateInventoryItemDto.branchId.
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  // Optional link to a marketplace products(id). null clears the link.
  @IsOptional()
  @IsUUID()
  productId?: string | null;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  // ISO date string (YYYY-MM-DD)
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  hsnCode?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  gstRate?: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  currentStock?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  minStockLevel?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  unitPrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  costPrice?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
