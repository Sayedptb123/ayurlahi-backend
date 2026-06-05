import { IsOptional, IsArray, IsString } from 'class-validator';

/**
 * Set a CRM staff member's data scope. Each array restricts visible leads on
 * that dimension; omit or send [] to remove the restriction there.
 */
export class SetStaffScopeDto {
  @IsOptional() @IsArray() @IsString({ each: true }) states?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) districts?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) stages?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) centreTypes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) priorities?: string[];
}
