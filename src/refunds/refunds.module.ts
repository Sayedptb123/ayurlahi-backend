import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefundsService } from './refunds.service';
import { RefundsController } from './refunds.controller';
import { Refund } from './entities/refund.entity';
import { RazorpayModule } from '../razorpay/razorpay.module';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Refund]),
    RazorpayModule,
    PaymentsModule,
    OrdersModule,
  ],
  controllers: [RefundsController],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}

