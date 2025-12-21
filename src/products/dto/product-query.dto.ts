import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ProductSortBy {
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NAME_ASC = 'name_asc',
  NAME_DESC = 'name_desc',
  STOCK_ASC = 'stock_asc',
  STOCK_DESC = 'stock_desc',
  CREATED_DESC = 'created_desc',
}

export enum StockStatus {
  IN_STOCK = 'in_stock',
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
}

export class ProductQueryDto {
  @IsOptional()
  @IsString()
  search?: string; // Search in name, description, SKU

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  manufacturerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsEnum(StockStatus)
  stockStatus?: StockStatus;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  inStock?: boolean; // Simple boolean: true = in stock, false = out of stock

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean; // Default: true (only active products)

  @IsOptional()
  @IsEnum(ProductSortBy)
  sortBy?: ProductSortBy; // Default: created_desc

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number; // Default: 1

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number; // Default: 20
}

