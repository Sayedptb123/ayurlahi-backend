import { IsOptional, IsString } from 'class-validator';
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateLeadDto } from './create-lead.dto';

/**
 * Update a lead's profile fields. Stage and assignment are intentionally NOT
 * updatable here — they have dedicated, audited endpoints (changeStage /
 * assign) with their own role rules.
 */
export class UpdateLeadDto extends PartialType(
  OmitType(CreateLeadDto, [
    'assignedTelecallerId',
    'assignedFieldStaffId',
    'force',
    'googlePlaceId',
  ] as const),
) {
  @IsOptional()
  @IsString()
  lostReason?: string;
}
