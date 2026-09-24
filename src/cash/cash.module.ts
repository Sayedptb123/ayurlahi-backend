import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { VoucherPostingService } from './voucher-posting.service';
import { CashLedgersService } from './cash-ledgers.service';
import { PatientPaymentPostingService } from './patient-payment-posting.service';
import { CashGoLiveService } from './cash-go-live.service';
import { CashController } from './cash.controller';

// Cash MVP (scope/Cash_Management_MVP_Implementation_Plan_2026-09-24.md).
// Foundation only for now: the posting service other modules call inside
// their own transactions. Accounts, day close, screens and reports follow.
@Module({
  imports: [AuditModule],
  controllers: [CashController],
  providers: [VoucherPostingService, CashLedgersService, PatientPaymentPostingService, CashGoLiveService],
  exports: [VoucherPostingService, CashLedgersService, PatientPaymentPostingService],
})
export class CashModule {}
