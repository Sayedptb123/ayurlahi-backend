import { IsOptional, IsString, MaxLength } from 'class-validator';

// Post-registration org details — filled in by the OWNER while the org is
// pending approval (PendingApproval screen) or later from settings. Every
// field is optional; only provided fields are updated.
export class UpdateOrgDetailsDto {
  @IsOptional() @IsString() @MaxLength(100) licenseNumber?: string;
  @IsOptional() @IsString() @MaxLength(50) gstin?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) state?: string;
  @IsOptional() @IsString() @MaxLength(10) pincode?: string;
  @IsOptional() @IsString() @MaxLength(20) orgPhone?: string;
}
