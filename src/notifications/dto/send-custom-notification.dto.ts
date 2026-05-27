import { IsString, IsOptional, IsArray, IsIn, IsUUID } from 'class-validator';

export class SendCustomNotificationDto {
  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsIn(['all', 'all_clinics', 'all_manufacturers', 'single_org'])
  targetType: 'all' | 'all_clinics' | 'all_manufacturers' | 'single_org';

  @IsOptional()
  @IsUUID()
  organisationId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  specificUserIds?: string[];
}
