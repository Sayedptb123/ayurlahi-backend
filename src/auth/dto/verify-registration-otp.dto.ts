import { Length, Matches } from 'class-validator';

export class VerifyRegistrationOtpDto {
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Invalid phone number' })
  phone: string;

  @Length(6, 6, { message: 'OTP must be 6 digits' })
  otp: string;
}
