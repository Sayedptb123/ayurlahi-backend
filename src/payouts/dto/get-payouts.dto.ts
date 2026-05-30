import { IsOptional, IsIn, IsNumberString, IsUUID } from 'class-validator';

export class GetPayoutsDto {
  @IsOptional()
  @IsNumberString()
  page?: number;

  @IsOptional()
  @IsNumberString()
  limit?: number;

  @IsOptional()
  @IsIn(['pending', 'processing', 'completed', 'failed'])
  status?: string;

  @IsOptional()
  @IsUUID()
  manufacturerId?: string;
}
