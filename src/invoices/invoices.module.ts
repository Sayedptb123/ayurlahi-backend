import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesService } from './invoices.service';
import { InvoiceGeneratorService } from './invoice-generator.service';
import { InvoicesController } from './invoices.controller';
import { Invoice } from './entities/invoice.entity';
import { OrdersModule } from '../orders/orders.module';
import { S3Module } from '../s3/s3.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { ManufacturersModule } from '../manufacturers/manufacturers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice]),
    OrdersModule,
    S3Module,
    ClinicsModule,
    ManufacturersModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceGeneratorService],
  exports: [InvoicesService],
})
export class InvoicesModule {}




