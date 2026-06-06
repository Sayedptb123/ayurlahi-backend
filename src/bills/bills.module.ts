import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillsService } from './bills.service';
import { BillsController } from './bills.controller';
import { RecurringBill } from './entities/recurring-bill.entity';
import { BillPayment } from './entities/bill-payment.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecurringBill, BillPayment, Expense, OrganisationUser]),
    NotificationsModule,
  ],
  controllers: [BillsController],
  providers: [BillsService],
  exports: [BillsService],
})
export class BillsModule {}
