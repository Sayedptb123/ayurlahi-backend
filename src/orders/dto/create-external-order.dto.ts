import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsIn,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExternalOrderItemDto {
  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;

  // The agreed selling price for this order, entered by the manufacturer --
  // may differ from the product's catalog price (see catalogPriceAtOrder,
  // snapshotted server-side, never written back to the catalog).
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  agreedUnitPrice: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateExternalOrderDto {
  @IsNotEmpty()
  @IsUUID()
  clinicId: string;

  // Mandatory -- the invoice "Billed To" address is derived from the
  // selected branch (see getManufacturerAccessibleClinicBranches), same
  // requirement that motivated the invoice branch-address fix.
  @IsNotEmpty()
  @IsUUID()
  branchId: string;

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ExternalOrderItemDto)
  items: ExternalOrderItemDto[];

  @IsNotEmpty()
  @IsIn(['whatsapp', 'phone'])
  channel: 'whatsapp' | 'phone';

  @IsOptional()
  @IsString()
  notes?: string;
}
