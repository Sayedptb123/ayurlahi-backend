import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { VoucherPostingService } from './voucher-posting.service';
import { CashLedgersService } from './cash-ledgers.service';
import { PatientPaymentPostingService } from './patient-payment-posting.service';

// Cash MVP (scope/Cash_Management_MVP_Implementation_Plan_2026-09-24.md).
// Foundation only for now: the posting service other modules call inside
// their own transactions. Accounts, day close, screens and reports follow.
@Module({
  imports: [AuditModule],
  providers: [VoucherPostingService, CashLedgersService, PatientPaymentPostingService],
  exports: [VoucherPostingService, CashLedgersService, PatientPaymentPostingService],
})
export class CashModule {}
