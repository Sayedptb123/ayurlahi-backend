import { IsOptional, IsObject } from 'class-validator';

export class CheckOutDto {
  @IsOptional()
  @IsObject()
  location?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
}

