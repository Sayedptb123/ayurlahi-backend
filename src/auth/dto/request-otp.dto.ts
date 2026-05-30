import { IsString, IsIn, IsEmail, Matches, ValidateIf } from 'class-validator';

export class RequestOtpDto {
  @IsIn(['sms', 'email'])
  channel: 'sms' | 'email';

  @ValidateIf((o) => o.channel === 'sms')
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Invalid phone number' })
  phone?: string;

  @ValidateIf((o) => o.channel === 'email')
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

  @IsString()
  @IsIn(['login', 'password_reset'])
  purpose: 'login' | 'password_reset';
}
