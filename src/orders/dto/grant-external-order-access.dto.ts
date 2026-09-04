import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class GrantExternalOrderAccessDto {
  @IsNotEmpty()
  @IsUUID()
  manufacturerId: string;

  @IsNotEmpty()
  @IsUUID()
  clinicId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
