import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsUUID, Min, ValidateNested } from 'class-validator';

export class OpeningBalanceDto {
  @IsUUID()
  accountId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;
}

// Counted cash per drawer and bank/UPI statement balances on go-live day.
export class GoLiveDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningBalanceDto)
  balances: OpeningBalanceDto[];
}
