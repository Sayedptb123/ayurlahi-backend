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

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ValidateIf((o) => o.role === UserRole.CLINIC || o.role === UserRole.MANUFACTURER)
  @IsOptional()
  @IsString()
  @MinLength(1)
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
}




