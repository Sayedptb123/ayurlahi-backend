import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsBoolean,
  ValidateIf,
} from 'class-validator';
import { UserRole } from '../../common/enums/role.enum';

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsEnum(UserRole)
  role: UserRole;

  @ValidateIf((o) => o.role === UserRole.CLINIC || o.role === UserRole.MANUFACTURER)
  @IsString()
  @MinLength(1, { message: 'Organization name is required for clinic and manufacturer roles' })
  organizationName?: string;

  @IsOptional()
  @IsPhoneNumber('IN')
  phone?: string;

  @IsOptional()
  @IsPhoneNumber('IN')
  whatsappNumber?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  sendWelcomeEmail?: boolean;
}

