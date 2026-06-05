import { IsOptional, IsInt, IsString, IsIn, IsBooleanString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryLeadsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 20;

  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() stage?: string;

  @IsOptional() @IsIn(['hot', 'warm', 'cold']) priority?: string;
  @IsOptional() @IsIn(['ayurvedic_clinic', 'postnatal', 'hospital_wing']) centreType?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() district?: string;

  // 'mine' (default for frontline) | 'all' (managers only — falls back to mine otherwise)
  @IsOptional() @IsIn(['mine', 'all']) scope?: 'mine' | 'all';

  // Follow-up pins for the telecaller home (B4)
  @IsOptional() @IsIn(['today', 'overdue', 'upcoming']) followUp?: string;

  @IsOptional() @IsBooleanString() isIncomplete?: string;
}
