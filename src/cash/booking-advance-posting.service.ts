import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { organisationBusinessDate } from '../common/business-date';
import { CashLedgersService } from './cash-ledgers.service';
import { PostedVoucher, VoucherPostingService } from './voucher-posting.service';

// Booking advances → vouchers (Cash MVP plan §5 R2/R3/R4). Called by
// RetreatService inside its own transactions:
//   advance received  → Receipt:  Dr received-into  / Cr Patient advances
//   advance voided    → reversal of that receipt
//   check-in transfer → Journal:  Dr Patient advances / Cr income   (no cash line)
//   refund            → Payment:  Dr Patient advances / Cr paid-from ledger
// Nothing posts while the organisation is not live. Advances taken before
// go-live were credited to Patient advances by the opening journal, so the
// transfer and refund work for them too.

export interface AdvanceReceiptForPosting {
  id: string;
  organisationId: string;
  bookingId: string;
  amount: number | string;
  receivedAt: string;
  paymentMethod: string;
  receivedIntoAccountId: string | null;
  referenceNo?: string | null;
}

type Actor = { userId: string; role?: string | null };

// Refund methods (room_bookings.refund_method) → the payment-method rules
// CashLedgersService uses for which ledgers can pay the money out.
const REFUND_METHOD: Record<string, string> = {
  CASH: 'cash',
  UPI: 'upi',
  CARD: 'card',
  BANK_TRANSFER: 'bank_transfer',
};

const paiseOf = (v: number | string) => Math.round(parseFloat(String(v)) * 100);

@Injectable()
export class BookingAdvancePostingService {
  constructor(
    private readonly posting: VoucherPostingService,
    private readonly ledgers: CashLedgersService,
  ) {}

  liveFrom(manager: EntityManager, organisationId: string) {
    return this.posting.liveFrom(manager, organisationId);
  }

  async postReceipt(
    manager: EntityManager,
    receipt: AdvanceReceiptForPosting,
    booking: { branchId: string | null },
    actor: Actor,
  ): Promise<PostedVoucher | null> {
    const receivedAt = receipt.receivedAt.slice(0, 10);
    const liveFrom = await this.posting.liveFrom(manager, receipt.organisationId);
    if (!liveFrom || receivedAt < liveFrom) return null;

    const today = await organisationBusinessDate(manager, receipt.organisationId);
    if (receivedAt > today) throw new BadRequestException(`Advance date ${receivedAt} is in the future`);
    if (!receipt.receivedIntoAccountId) {
      throw new BadRequestException('Choose where this advance was received (cash drawer, bank, UPI or partner)');
    }
    await this.ledgers.checkReceivingAccount(manager, receipt.organisationId, receipt.receivedIntoAccountId, receipt.paymentMethod, booking.branchId);
    const advances = await this.patientAdvancesLedger(manager, receipt.organisationId);
    const amount = paiseOf(receipt.amount) / 100;

    return this.posting.post(manager, {
      organisationId: receipt.organisationId,
      voucherType: 'receipt',
      voucherDate: today,
      originalDate: receivedAt < today ? receivedAt : null,
      branchId: booking.branchId,
      narration: `Booking advance (${receipt.paymentMethod}${receipt.referenceNo ? `, ref ${receipt.referenceNo}` : ''})`,
      sourceType: 'booking_advance',
      sourceId: receipt.id,
      lines: [
        { accountId: receipt.receivedIntoAccountId, debit: amount, branchId: booking.branchId },
        { accountId: advances, credit: amount, branchId: booking.branchId },
      ],
      createdBy: actor.userId,
      actorRole: actor.role ?? null,
    });
  }

  async reverseReceipt(manager: EntityManager, organisationId: string, receiptId: string, actor: Actor) {
    const [v] = await manager.query(
      `SELECT id FROM vouchers WHERE organisation_id = $1 AND source_type = 'booking_advance' AND source_id = $2`,
      [organisationId, receiptId],
    );
    if (!v) return null;
    return this.posting.reverse(manager, {
      organisationId, voucherId: v.id, reason: 'Booking advance voided', createdBy: actor.userId, actorRole: actor.role ?? null,
    });
  }

  // Check-in: the advance already sitting in Patient advances becomes income
  // on the admission's bill. No cash, bank or UPI line.
  async postTransfer(
    manager: EntityManager,
    t: { organisationId: string; admissionId: string; billId: string; branchId: string | null; amount: number | string },
    actor: Actor,
  ): Promise<PostedVoucher | null> {
    const paise = paiseOf(t.amount);
    if (paise <= 0) return null;
    if (!(await this.posting.liveFrom(manager, t.organisationId))) return null;
    const advances = await this.patientAdvancesLedger(manager, t.organisationId);
    const shares = await this.ledgers.incomeShares(manager, t.organisationId, t.billId, paise);
    return this.posting.post(manager, {
      organisationId: t.organisationId,
      voucherType: 'journal',
      branchId: t.branchId,
      narration: 'Booking advance moved to the admission bill at check-in',
      sourceType: 'advance_transfer',
      sourceId: t.admissionId,
      lines: [
        { accountId: advances, debit: paise / 100, branchId: t.branchId },
        ...shares.map((s) => ({ accountId: s.accountId, credit: s.paise / 100, branchId: t.branchId })),
      ],
      createdBy: actor.userId,
      actorRole: actor.role ?? null,
    });
  }

  // Refund of a cancelled booking's advance.
  async postRefund(
    manager: EntityManager,
    r: { organisationId: string; bookingId: string; branchId: string | null; amount: number | string; method: string; paidFromAccountId?: string | null },
    actor: Actor,
  ): Promise<PostedVoucher | null> {
    const paise = paiseOf(r.amount);
    if (paise <= 0) return null;
    if (!(await this.posting.liveFrom(manager, r.organisationId))) return null;
    if (!r.paidFromAccountId) {
      throw new BadRequestException('Choose which cash drawer, bank or UPI account the refund was paid from');
    }
    const method = REFUND_METHOD[r.method];
    if (!method) throw new BadRequestException(`A refund by "${r.method}" can't be recorded once cash tracking is live`);
    await this.ledgers.checkReceivingAccount(manager, r.organisationId, r.paidFromAccountId, method, r.branchId);
    const advances = await this.patientAdvancesLedger(manager, r.organisationId);
    return this.posting.post(manager, {
      organisationId: r.organisationId,
      voucherType: 'payment',
      branchId: r.branchId,
      narration: `Refund of booking advance (${r.method.toLowerCase()})`,
      sourceType: 'booking_refund',
      sourceId: r.bookingId,
      lines: [
        { accountId: advances, debit: paise / 100, branchId: r.branchId },
        { accountId: r.paidFromAccountId, credit: paise / 100, branchId: r.branchId },
      ],
      createdBy: actor.userId,
      actorRole: actor.role ?? null,
    });
  }

  private async patientAdvancesLedger(manager: EntityManager, organisationId: string): Promise<string> {
    const [a] = await manager.query(
      `SELECT id FROM accounts WHERE organisation_id = $1 AND system_key = 'patient_advances' AND is_active`,
      [organisationId],
    );
    if (!a) throw new BadRequestException('Cash ledgers are not set up for this organisation');
    return a.id;
  }
}
