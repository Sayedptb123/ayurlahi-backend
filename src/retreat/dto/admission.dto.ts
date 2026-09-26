import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class DischargeAdmissionDto {
    // Calendar day the patient actually left, in the organisation's timezone.
    // Omitted = now.
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'actualCheckOutDate must be YYYY-MM-DD' })
    actualCheckOutDate?: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string;
}
