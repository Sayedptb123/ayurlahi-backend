import { IsOptional, IsInt, IsEnum, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../enums/user-role.enum';

export enum UserRoleEnum {
  CLINIC = 'clinic',
  MANUFACTURER = 'manufacturer',
  ADMIN = 'admin',
  SUPPORT = 'support',
}

export class GetUsersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(UserRoleEnum)
  role?: UserRole;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  email?: string;
}
