import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePurchaseOrderItemDto {
  // Legacy -- resolves against inventory_items. Left for backward
  // compatibility; new callers should use itemMasterId instead.
  @IsUUID()
  @IsOptional()
  itemId?: string;

  // ADR-005 Step 3 -- resolves against inventory_item_masters.
  @IsUUID()
  @IsOptional()
  itemMasterId?: string;

  @IsString()
  @IsNotEmpty()
  itemName: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreatePurchaseOrderDto {
  // ADR-005 Step 3 -- resolved server-side via
  // BranchVisibilityService.resolveBranchIdForWrite, same rule as every
  // other inventory write path.
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsUUID()
  @IsNotEmpty()
  supplierId: string;

  @IsString()
  @IsNotEmpty()
  poNumber: string;

  @IsDateString()
  @IsOptional()
  orderDate?: string;

  @IsDateString()
  @IsOptional()
  expectedDeliveryDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];
}

export class UpdatePurchaseOrderDto {
  @IsString()
  @IsOptional()
  poNumber?: string;

  @IsDateString()
  @IsOptional()
  expectedDeliveryDate?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
