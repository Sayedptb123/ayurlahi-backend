import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { BillItemType } from '../entities/bill-item.entity';

export class BillItemDto {
  @IsNotEmpty()
  @IsEnum(BillItemType)
  itemType: BillItemType;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  itemName: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsString()
  description?: string;
}



