import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsPhoneNumber,
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

export class CreateClinicDto {
  @IsString()
  @IsNotEmpty()
  clinicName: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsString()
  @IsNotEmpty()
  licenseNumber: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsOptional()
  @IsString()
  district?: string;

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
  @ValidateNested()
  @Type(() => DocumentsDto)
  documents?: DocumentsDto;
}




