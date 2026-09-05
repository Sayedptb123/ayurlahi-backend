import { IsUUID } from 'class-validator';

export class NotifyManufacturerDto {
  @IsUUID()
  manufacturerId: string;
}
