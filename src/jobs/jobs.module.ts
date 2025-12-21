import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getRedisConfig } from '../common/config/redis.config';
import { InvoiceGenerationProcessor } from './processors/invoice-generation.processor';
import { OrderStatusUpdateProcessor } from './processors/order-status-update.processor';
import { WhatsAppNotificationProcessor } from './processors/whatsapp-notification.processor';
import { InvoicesModule } from '../invoices/invoices.module';
import { OrdersModule } from '../orders/orders.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: getRedisConfig(configService),
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'invoice-generation' },
      { name: 'order-status-update' },
      { name: 'whatsapp-notification' },
    ),
    InvoicesModule,
    OrdersModule,
    WhatsAppModule,
  ],
  providers: [
    InvoiceGenerationProcessor,
    OrderStatusUpdateProcessor,
    WhatsAppNotificationProcessor,
  ],
  exports: [BullModule],
})
export class JobsModule {}

