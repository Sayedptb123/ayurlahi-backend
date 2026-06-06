import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  IsArray,
  ValidateNested,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TreatmentProtocolItemDto {
  @IsOptional()
  @IsUUID()
  productId?: string | null;

  @IsString()
  @IsNotEmpty()
  itemName: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsString()
  @IsOptional()
  unit?: string;
}

export class CreateTreatmentProtocolDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsUUID()
  packageId?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TreatmentProtocolItemDto)
  items: TreatmentProtocolItemDto[];
}
