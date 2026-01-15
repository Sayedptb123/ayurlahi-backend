import { IsOptional, IsObject } from 'class-validator';

export class CheckInDto {
  @IsOptional()
  @IsObject()
  location?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
}


