import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { RazorpayWebhookController } from './payments.webhook.controller';
import { Payment } from './entities/payment.entity';
import { RazorpayModule } from '../razorpay/razorpay.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    BullModule.registerQueue({ name: 'invoice-generation' }),
    RazorpayModule,
    OrdersModule,
  ],
  controllers: [PaymentsController, RazorpayWebhookController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}

