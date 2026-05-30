import { IsString, MinLength, Length } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  identifier: string; // phone number or email address

  @IsString()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  otp: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword: string;
}
