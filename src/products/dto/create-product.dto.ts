import {
    IsString,
    IsNotEmpty,
    IsNumber,
    Min,
    Max,
    IsArray,
    IsOptional,
    IsBoolean,
    IsObject,
    IsEnum,
    IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductStatus } from '../enums/product-status.enum';

export class CreateProductDto {
    @IsString()
    @IsNotEmpty()
    sku: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    category?: string;

    @IsString()
    @IsOptional()
    batchNumber?: string;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    expiryDate?: Date;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    manufacturingDate?: Date;

    @IsNumber()
    @Min(0)
    price: number;

    @IsEnum(['INTERNAL', 'DROPSHIP'])
    @IsOptional()
    fulfillmentType?: 'INTERNAL' | 'DROPSHIP';

    @IsString()
    @IsOptional()
    vendorId?: string;

    @IsNumber()
    @Min(0)
    @Max(100)
    gstRate: number;

    @IsNumber()
    @Min(0)
    stockQuantity: number;

    @IsString()
    @IsOptional()
    unit?: string;

    @IsNumber()
    @Min(1)
    @IsOptional()
    minOrderQuantity?: number;

    @IsArray()
    @IsOptional()
    images?: string[];

    @IsObject()
    @IsOptional()
    specifications?: Record<string, any>;

    @IsBoolean()
    @IsOptional()
    requiresPrescription?: boolean;

    @IsString()
    @IsOptional()
    licenseNumber?: string;

    @IsEnum(ProductStatus)
    @IsOptional()
    status?: ProductStatus;
}
