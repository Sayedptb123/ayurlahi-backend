import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ProductRequestStatus } from '../entities/product-request.entity';

export class UpdateProductRequestStatusDto {
  @IsEnum(ProductRequestStatus)
  status: ProductRequestStatus;

  @IsString()
  @IsOptional()
  resolutionNotes?: string;
}
