import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class InviteStaffDto {
    @IsBoolean()
    @IsOptional()
    sendEmail?: boolean = true;

    @IsBoolean()
    @IsOptional()
    sendSMS?: boolean = false;

    @IsString()
    @IsOptional()
    customMessage?: string;
}
