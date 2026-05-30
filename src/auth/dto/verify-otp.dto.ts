import { IsString, IsIn, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  identifier: string; // phone number or email address

  @IsString()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  otp: string;

  @IsString()
  @IsIn(['login', 'password_reset'])
  purpose: 'login' | 'password_reset';
}
