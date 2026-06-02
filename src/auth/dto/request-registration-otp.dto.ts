import { Matches } from 'class-validator';

export class RequestRegistrationOtpDto {
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Invalid phone number' })
  phone: string;
}
