import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
} from 'class-validator';

export type UserRole = 'clinic' | 'manufacturer' | 'admin' | 'support';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsEnum(['clinic', 'manufacturer'])
  role: 'clinic' | 'manufacturer';

  @IsOptional()
  @IsString()
  phone?: string;
}







