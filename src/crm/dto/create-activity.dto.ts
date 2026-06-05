import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsInt,
  IsNumber,
  IsBoolean,
  IsArray,
  IsDateString,
  ValidateIf,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CRM_CALL_DISPOSITIONS } from '../enums/crm.enums';

export class CreateActivityDto {
  @IsIn(['call', 'whatsapp', 'visit', 'email', 'note'])
  type: string;

  // Mandatory for calls — a call can never be left un-dispositioned (B4).
  @ValidateIf((o) => o.type === 'call')
  @IsIn(CRM_CALL_DISPOSITIONS as unknown as string[])
  @IsNotEmpty()
  disposition?: string;

  @IsOptional() @IsString() notes?: string;

  // The REAL moment of the touch. Offline activities send their original
  // timestamp here; the server records sync time separately (B5, A5).
  @IsOptional() @IsDateString() occurredAt?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) durationSeconds?: number;

  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;

  @IsOptional() @IsArray() @IsString({ each: true }) attachments?: string[];

  @IsOptional() @IsString() nextAction?: string;
  // If set, the lead's next_follow_up is updated and a follow-up task is
  // created (B6). Must be in the future (B8).
  @IsOptional() @IsDateString() nextActionDueAt?: string;

  // Android cross-checks the device call log and reports verification (B4, B7).
  @IsOptional() @IsBoolean() callLogVerified?: boolean;

  @IsOptional() @IsString() whatsappTemplate?: string;

  @IsOptional() @IsBoolean() createdOffline?: boolean;
}
