import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsNumber,
  Min,
  Max,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class DocumentsDto {
  @IsOptional()
  @IsString()
  license?: string;

  @IsOptional()
  @IsString()
  gstCertificate?: string;

  @IsOptional()
  @IsString()
  addressProof?: string;
}

export class CreateManufacturerDto {
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsString()
  @IsNotEmpty()
  gstin: string;

  @IsString()
  @IsNotEmpty()
  licenseNumber: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  pincode: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsOptional()
  @IsPhoneNumber('IN')
  phone?: string;

  @IsOptional()
  @IsPhoneNumber('IN')
  whatsappNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentsDto)
  documents?: DocumentsDto;
}





