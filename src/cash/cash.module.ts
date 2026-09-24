import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { VoucherPostingService } from './voucher-posting.service';

// Cash MVP (scope/Cash_Management_MVP_Implementation_Plan_2026-09-24.md).
// Foundation only for now: the posting service other modules call inside
// their own transactions. Accounts, day close, screens and reports follow.
@Module({
  imports: [AuditModule],
  providers: [VoucherPostingService],
  exports: [VoucherPostingService],
})
export class CashModule {}
