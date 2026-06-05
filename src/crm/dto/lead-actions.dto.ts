import {
  IsOptional,
  IsString,
  IsNotEmpty,
  IsUUID,
  ValidateIf,
} from 'class-validator';

/** Assign / reassign a lead's telecaller and/or field staff (B1, manager). */
export class AssignLeadDto {
  @IsOptional() @IsUUID() telecallerId?: string | null;
  @IsOptional() @IsUUID() fieldStaffId?: string | null;
}

/** Change a lead's pipeline stage (B2). Lost requires a mandatory reason. */
export class ChangeStageDto {
  @IsString()
  @IsNotEmpty()
  stage: string;

  // Mandatory when moving to the 'lost' stage (B2).
  @ValidateIf((o) => o.stage === 'lost')
  @IsString()
  @IsNotEmpty()
  lostReason?: string;
}
