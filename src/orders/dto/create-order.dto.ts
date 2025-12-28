import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderSource } from '../entities/order.entity';

export class OrderItemDto {
  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOrderDto {
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @IsString()
  shippingAddress?: string;

  @IsOptional()
  @IsString()
  shippingCity?: string;

  @IsOptional()
  @IsString()
  shippingDistrict?: string;

  @IsOptional()
  @IsString()
  shippingState?: string;

  @IsOptional()
  @IsString()
  shippingPincode?: string;

  @IsOptional()
  @IsString()
  shippingPhone?: string;

  @IsOptional()
  @IsString()
  shippingContactName?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(OrderSource)
  source?: OrderSource;
}
