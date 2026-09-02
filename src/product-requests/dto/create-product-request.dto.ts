import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateProductRequestDto {
  @IsString()
  @IsNotEmpty()
  productName: string;

  @IsString()
  @IsOptional()
  manufacturerHint?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
