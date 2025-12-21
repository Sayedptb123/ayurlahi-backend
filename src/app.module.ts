import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { getDatabaseConfig } from './common/config/database.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

// Core modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClinicsModule } from './clinics/clinics.module';
import { ManufacturersModule } from './manufacturers/manufacturers.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { InvoicesModule } from './invoices/invoices.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { RazorpayModule } from './razorpay/razorpay.module';
import { S3Module } from './s3/s3.module';
import { AuditModule } from './audit/audit.module';
import { DisputesModule } from './disputes/disputes.module';
import { RefundsModule } from './refunds/refunds.module';
import { JobsModule } from './jobs/jobs.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { StaffModule } from './staff/staff.module';

// Entities
import { User } from './users/entities/user.entity';
import { Clinic } from './clinics/entities/clinic.entity';
import { Manufacturer } from './manufacturers/entities/manufacturer.entity';
import { Product } from './products/entities/product.entity';
import { Order } from './orders/entities/order.entity';
import { OrderItem } from './orders/entities/order-item.entity';
import { Payment } from './payments/entities/payment.entity';
import { Invoice } from './invoices/entities/invoice.entity';
import { Subscription } from './subscriptions/entities/subscription.entity';
import { AuditLog } from './audit/entities/audit-log.entity';
import { Dispute } from './disputes/entities/dispute.entity';
import { Refund } from './refunds/entities/refund.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    // Core modules
    AuthModule,
    UsersModule,
    ClinicsModule,
    ManufacturersModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    InvoicesModule,
    SubscriptionsModule,
    WhatsAppModule,
    RazorpayModule,
    S3Module,
    AuditModule,
    DisputesModule,
    RefundsModule,
    JobsModule,
    AnalyticsModule,
    StaffModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
