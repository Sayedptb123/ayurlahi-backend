import { PartialType } from '@nestjs/swagger';
import { CreateRecurringBillDto } from './create-recurring-bill.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateRecurringBillDto extends PartialType(CreateRecurringBillDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
