import {
  IsOptional,
  IsString,
  IsIn,
  IsInt,
  IsBoolean,
  IsArray,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export class CreateRequirementDto {
  @IsOptional() @IsUUID() activityId?: string;

  @IsOptional() @IsIn(['high', 'medium', 'low']) interestLevel?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) modulesWanted?: string[];
  @IsOptional() @IsString() painPoints?: string;
  @IsOptional() @IsString() objections?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bedCount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) patientsPerMonth?: number;

  @IsOptional() @IsString() decisionMakerName?: string;
  @IsOptional() @IsBoolean() spokeToDecisionMaker?: boolean;
  @IsOptional() @IsString() decisionTimeline?: string;
  @IsOptional() @IsString() competitor?: string;
  @IsOptional() @IsString() pricingDiscussed?: string;
  @IsOptional() @IsString() pricingReaction?: string;
  @IsOptional() @IsString() verbatimFeedback?: string;
}

export class UpdateRequirementDto extends PartialType(CreateRequirementDto) {}
