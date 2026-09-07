import { IsInt, Min } from 'class-validator';

// Amendment: change the requested quantity of an existing line, before
// PACKED. quantity here is the new *requested* amount -- reservation is
// recomputed against current stock, capped, never rejected outright.
export class UpdateOrderItemQuantityDto {
  @IsInt()
  @Min(1)
  quantity: number;
}
