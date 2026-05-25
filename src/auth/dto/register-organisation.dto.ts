import { IsString, IsNotEmpty, IsOptional, IsEnum, MinLength, IsEmail } from 'class-validator';

export class RegisterOrganisationDto {
  // Personal info
  @IsString() @IsNotEmpty() firstName: string;
  @IsString() @IsNotEmpty() lastName: string;
  @IsEmail() email: string;
  @IsString() @IsNotEmpty() phone: string;
  @IsString() @MinLength(6) password: string;

  // Org info
  @IsEnum(['CLINIC', 'MANUFACTURER']) orgType: 'CLINIC' | 'MANUFACTURER';
  @IsString() @IsNotEmpty() orgName: string;

  @IsOptional() @IsString() licenseNumber?: string;
  @IsOptional() @IsString() gstin?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() orgPhone?: string;
  @IsOptional() @IsString() whatsappNumber?: string;
}
