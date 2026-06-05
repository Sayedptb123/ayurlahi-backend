import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsInt,
  IsNumber,
  IsIn,
  IsUUID,
  IsArray,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { CrmCentreType, CrmPriority } from '../enums/crm.enums';

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsIn(['ayurvedic_clinic', 'postnatal', 'hospital_wing'])
  centreType?: CrmCentreType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bedCount?: number;

  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() area?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() state?: string;

  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;

  @IsOptional() @IsString() primaryContactName?: string;
  @IsOptional() @IsString() primaryContactDesignation?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() phoneSecondary?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsEmail() email?: string;

  @IsOptional() @IsString() leadSource?: string;
  @IsOptional() @IsString() ownerDoctorName?: string;
  @IsOptional() @IsBoolean() ownerDoctorIsBams?: boolean;
  @IsOptional() @IsString() currentSoftware?: string;

  @IsOptional()
  @IsIn(['hot', 'warm', 'cold'])
  priority?: CrmPriority;

  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];

  @IsOptional() @IsString() googlePlaceId?: string;
  @IsOptional() @IsString() googleMapsUrl?: string;
  @IsOptional() @IsString() website?: string;

  // Manager-only at the service layer; ignored for frontline creators.
  @IsOptional() @IsUUID() assignedTelecallerId?: string;
  @IsOptional() @IsUUID() assignedFieldStaffId?: string;

  // Set true to create despite a duplicate-phone/place warning (B8).
  @IsOptional() @IsBoolean() force?: boolean;
}
