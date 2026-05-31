import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DisputeType } from '../entities/dispute.entity';

export class CreateDisputeDto {
  @IsNotEmpty()
  @IsUUID()
  orderId: string;

  @IsNotEmpty()
  @IsEnum(DisputeType)
  type: DisputeType;

  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  evidence?: string;
}
