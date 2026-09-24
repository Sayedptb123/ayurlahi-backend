import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { organisationBusinessDate } from '../common/business-date';
import { CashLedgersService } from './cash-ledgers.service';
import { PostedVoucher, VoucherPostingService } from './voucher-posting.service';

// Patient payments → Receipt Vouchers (Cash MVP plan §5 R1/R5). Called by
// PatientBillingService inside its own transaction, after the payment row is
// saved, so the payment and its voucher commit or roll back together.
//
// Dating: the voucher is dated today's business date. A backdated payment keeps
// its real day as original_date, so a closed day is never written into (D11).
// A payment dated before the organisation went live is not posted: that money
// was already in the opening count (D10).

export interface PatientPaymentForPosting {
  id: string;
  organisationId: string;
  billId: string;
  amount: number | string;
  paidAt: string;
  paymentMethod: string;
  receivedIntoAccountId: string | null;
  referenceNo?: string | null;
}

export interface BillForPosting {
  id: string;
  billNumber: string;
  branchId: string | null;
}

@Injectable()
export class PatientPaymentPostingService {
  constructor(
    private readonly posting: VoucherPostingService,
    private readonly ledgers: CashLedgersService,
  ) {}

  // Checks a receiving ledger chosen on the form, whether or not the module is live.
  async checkReceivingAccount(
    manager: EntityManager,
    organisationId: string,
    accountId: string | null | undefined,
    paymentMethod: string,
  ): Promise<void> {
    if (accountId) {
      await this.ledgers.checkReceivingAccount(manager, organisationId, accountId, paymentMethod);
    }
  }

  async post(
    manager: EntityManager,
    payment: PatientPaymentForPosting,
    bill: BillForPosting,
    actor: { userId: string; role?: string | null },
  ): Promise<PostedVoucher | null> {
    const paidAt = payment.paidAt.slice(0, 10);
    const liveFrom = await this.posting.liveFrom(manager, payment.organisationId);
    if (!liveFrom || paidAt < liveFrom) return null;

    const today = await organisationBusinessDate(manager, payment.organisationId);
    if (paidAt > today) {
      throw new BadRequestException(`Payment date ${paidAt} is in the future`);
    }
    if (!payment.receivedIntoAccountId) {
      throw new BadRequestException('Choose where this payment was received (cash drawer, bank, UPI or partner)');
    }
    await this.ledgers.checkReceivingAccount(
      manager, payment.organisationId, payment.receivedIntoAccountId, payment.paymentMethod,
    );

    const paise = Math.round(parseFloat(String(payment.amount)) * 100);
    const shares = await this.ledgers.incomeShares(manager, payment.organisationId, bill.id, paise);

    return this.posting.post(manager, {
      organisationId: payment.organisationId,
      voucherType: 'receipt',
      voucherDate: today,
      originalDate: paidAt < today ? paidAt : null,
      branchId: bill.branchId,
      narration: `Payment for bill ${bill.billNumber} (${payment.paymentMethod}${payment.referenceNo ? `, ref ${payment.referenceNo}` : ''})`,
      sourceType: 'patient_payment',
      sourceId: payment.id,
      lines: [
        { accountId: payment.receivedIntoAccountId, debit: paise / 100, branchId: bill.branchId },
        ...shares.map((s) => ({ accountId: s.accountId, credit: s.paise / 100, branchId: bill.branchId })),
      ],
      createdBy: actor.userId,
      actorRole: actor.role ?? null,
    });
  }

  // Voiding a payment reverses its voucher, if it had one (payments from
  // before go-live have none). The original voucher is never changed.
  async reverse(
    manager: EntityManager,
    organisationId: string,
    paymentId: string,
    actor: { userId: string; role?: string | null },
  ): Promise<PostedVoucher | null> {
    const [voucher] = await manager.query(
      `SELECT id FROM vouchers WHERE organisation_id = $1 AND source_type = 'patient_payment' AND source_id = $2`,
      [organisationId, paymentId],
    );
    if (!voucher) return null;
    return this.posting.reverse(manager, {
      organisationId,
      voucherId: voucher.id,
      reason: 'Patient payment voided',
      createdBy: actor.userId,
      actorRole: actor.role ?? null,
    });
  }
}
