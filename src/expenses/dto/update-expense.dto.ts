import { PartialType } from '@nestjs/mapped-types';
import { CreateExpenseDto } from './create-expense.dto';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {
    @IsOptional()
    @IsIn(['pending', 'verified', 'flagged'])
    status?: string;

    @IsOptional()
    @IsString()
    flagReason?: string;

    @IsOptional()
    @IsUUID()
    approvedBy?: string;
}
