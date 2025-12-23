import { IsOptional, IsString } from 'class-validator';

export class RejectClinicDto {
  @IsString()
  reason: string;
}




