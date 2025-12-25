import { IsString } from 'class-validator';

export class RejectManufacturerDto {
  @IsString()
  reason: string;
}





