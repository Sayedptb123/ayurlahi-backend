import { IsUUID, IsDateString, IsOptional, IsNumber, IsString, IsEnum, IsBoolean, Min } from 'class-validator';
import { BookingStatus, RefundMethod } from '../entities/room-booking.entity';
import { PaymentMethod } from '../../patient-billing/entities/patient-bill.entity';

export class CreateBookingDto {
    @IsOptional()
    @IsUUID()
    patientId?: string;

    @IsOptional()
    @IsUUID()
    enquiryId?: string;

    @IsUUID()
    roomId: string;

    @IsOptional()
    @IsUUID()
    packageId?: string;

    @IsDateString()
    checkInDate: string;

    @IsDateString()
    checkOutDate: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    totalPrice?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    advancePaid?: number;

    // Cash tracking (once live): how the initial advance was paid and where
    // it was received. Recorded as an advance receipt, not just a number.
    @IsOptional()
    @IsEnum(PaymentMethod)
    advancePaymentMethod?: PaymentMethod;

    @IsOptional()
    @IsUUID()
    advanceReceivedIntoAccountId?: string;

    @IsOptional()
    @IsUUID()
    advanceIdempotencyKey?: string;

    @IsOptional()
    @IsString()
    discountReason?: string;

    @IsOptional()
    @IsBoolean()
    acRequired?: boolean;

    @IsOptional()
    @IsString()
    notes?: string;

    // ADR-004 D9. Omit for organisation-wide (NULL); validated but not yet
    // enforced at read time until Phase 4.
    @IsOptional()
    @IsUUID()
    branchId?: string;
}

export class UpdateBookingDto {
    @IsOptional()
    @IsUUID()
    roomId?: string;

    @IsOptional()
    @IsUUID()
    packageId?: string;

    @IsOptional()
    @IsDateString()
    checkInDate?: string;

    @IsOptional()
    @IsDateString()
    checkOutDate?: string;

    @IsOptional()
    @IsEnum(BookingStatus)
    status?: BookingStatus;

    @IsOptional()
    @IsNumber()
    @Min(0)
    totalPrice?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    advancePaid?: number;

    @IsOptional()
    @IsString()
    discountReason?: string;

    @IsOptional()
    @IsBoolean()
    acRequired?: boolean;

    @IsOptional()
    @IsString()
    notes?: string;

    // ADR-004 D9. See CreateBookingDto.
    @IsOptional()
    @IsUUID()
    branchId?: string;
}

export class RecordRefundDto {
    // Lower bound enforced here (>= 0); the upper bound (<= advancePaid) can
    // only be checked in the service, against the specific booking's stored
    // advance_paid.
    @IsNumber()
    @Min(0)
    amount: number;

    @IsEnum(RefundMethod)
    method: RefundMethod;

    // Cash tracking (once live): the ledger the refund was paid from.
    @IsOptional()
    @IsUUID()
    paidFromAccountId?: string;

    @IsOptional()
    @IsString()
    note?: string;
}

export class CheckAvailabilityDto {
    @IsUUID()
    roomId: string;

    @IsDateString()
    checkInDate: string;

    @IsDateString()
    checkOutDate: string;

    @IsOptional()
    @IsUUID()
    excludeBookingId?: string;
}

// "Record advance" (cash MVP batch 1): each advance is its own receipt row, so
// once cash tracking is live advance_paid is never edited directly.
export class RecordAdvanceDto {
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0.01)
    amount: number;

    @IsEnum(PaymentMethod)
    paymentMethod: PaymentMethod;

    // Required once cash tracking is live.
    @IsOptional()
    @IsUUID()
    receivedIntoAccountId?: string;

    // The day the money was received; defaults to today's business date.
    @IsOptional()
    @IsDateString()
    receivedAt?: string;

    @IsOptional()
    @IsString()
    referenceNo?: string;

    @IsOptional()
    @IsString()
    notes?: string;

    // One per form submit, so a double-tap can't record the advance twice.
    @IsOptional()
    @IsUUID()
    idempotencyKey?: string;
}

// Promote a booking's enquiry to a patient. Phone never decides identity:
// either the receptionist picked an existing patient (patientId), or asked
// for a new one (createNew). With neither, the server creates a new patient
// only when no visible patient shares the enquiry phone.
export class PromoteBookingDto {
    @IsOptional()
    @IsUUID()
    patientId?: string;

    @IsOptional()
    @IsBoolean()
    createNew?: boolean;
}
