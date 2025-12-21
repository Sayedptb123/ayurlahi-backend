import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { OrdersModule } from '../orders/orders.module';
import { ClinicsModule } from '../clinics/clinics.module';

@Module({
  imports: [OrdersModule, ClinicsModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}





