import { IsNumber, IsEnum, Min, Max, IsOptional, IsString } from 'class-validator';

export class UpdateOrderItemDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippedQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveredQuantity?: number;

  @IsOptional()
  @IsEnum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}





