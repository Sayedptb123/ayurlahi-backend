import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { organisationBusinessDate } from '../common/business-date';
import { CashLedgersService, expenseLedgerKey } from './cash-ledgers.service';
import { PostedVoucher, VoucherPostingService } from './voucher-posting.service';

// Hospital costs paid from the hospital's own money → Payment Vouchers (Cash
// MVP plan §5 R6/R7): a recorded recurring-bill payment, or an asset
// maintenance cost. Dr expense ledger (by category) / Cr the paid-from cash
// drawer, bank or UPI ledger. Called inside the source module's transaction.
// A bill merely falling due is not a payment and never posts.

export interface CostPayment {
  organisationId: string;
  sourceType: 'bill_payment' | 'asset_maintenance';
  sourceId: string;
  paidOn: string;            // the day it was paid (YYYY-MM-DD)
  amount: number | string;
  category: string;          // expenses.category → expense ledger
  paidFromAccountId?: string | null;
  branchId?: string | null;
  narration: string;
}

@Injectable()
export class CostPaymentPostingService {
  constructor(
    private readonly posting: VoucherPostingService,
    private readonly ledgers: CashLedgersService,
  ) {}

  liveFrom(manager: EntityManager, organisationId: string) {
    return this.posting.liveFrom(manager, organisationId);
  }

  // Checks a paid-from ledger chosen on the form, whether or not the module is live.
  async checkPaidFrom(manager: EntityManager, organisationId: string, accountId: string | null | undefined, costBranchId: string | null) {
    if (accountId) await this.ledgers.checkReceivingAccount(manager, organisationId, accountId, 'hospital', costBranchId);
  }

  async post(manager: EntityManager, c: CostPayment, actor: { userId: string; role?: string | null }): Promise<PostedVoucher | null> {
    const paise = Math.round(parseFloat(String(c.amount)) * 100);
    if (!(paise > 0)) return null;
    const paidOn = c.paidOn.slice(0, 10);
    const liveFrom = await this.posting.liveFrom(manager, c.organisationId);
    if (!liveFrom || paidOn < liveFrom) return null;

    const today = await organisationBusinessDate(manager, c.organisationId);
    if (paidOn > today) throw new BadRequestException(`Payment date ${paidOn} is in the future`);
    if (!c.paidFromAccountId) {
      throw new BadRequestException('Choose which cash drawer, bank or UPI account this was paid from');
    }
    await this.ledgers.checkReceivingAccount(manager, c.organisationId, c.paidFromAccountId, 'hospital', c.branchId ?? null);

    const key = expenseLedgerKey(c.category);
    const [expense] = await manager.query(
      `SELECT id FROM accounts WHERE organisation_id = $1 AND system_key = $2 AND is_active`,
      [c.organisationId, key],
    );
    if (!expense) throw new BadRequestException('Cash ledgers are not set up for this organisation');

    return this.posting.post(manager, {
      organisationId: c.organisationId,
      voucherType: 'payment',
      voucherDate: today,
      originalDate: paidOn < today ? paidOn : null,
      branchId: c.branchId ?? null,
      narration: c.narration,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      lines: [
        { accountId: expense.id, debit: paise / 100, branchId: c.branchId ?? null },
        { accountId: c.paidFromAccountId, credit: paise / 100, branchId: c.branchId ?? null },
      ],
      createdBy: actor.userId,
      actorRole: actor.role ?? null,
    });
  }
}
