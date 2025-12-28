import { IsString } from 'class-validator';

export class ResolveDisputeDto {
  @IsString()
  resolution: string;
}
