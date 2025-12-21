import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
} from 'class-validator';
import { DisputeType } from '../../common/enums/dispute-type.enum';

export class CreateDisputeDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsEnum(DisputeType)
  type: DisputeType;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsObject()
  evidence?: {
    images?: string[];
    documents?: string[];
    notes?: string;
  };
}





