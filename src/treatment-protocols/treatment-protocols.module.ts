import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TreatmentProtocolsService } from './treatment-protocols.service';
import { TreatmentProtocolsController } from './treatment-protocols.controller';
import { TreatmentProtocol } from './entities/treatment-protocol.entity';
import { TreatmentProtocolItem } from './entities/treatment-protocol-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TreatmentProtocol, TreatmentProtocolItem]),
  ],
  controllers: [TreatmentProtocolsController],
  providers: [TreatmentProtocolsService],
  exports: [TreatmentProtocolsService],
})
export class TreatmentProtocolsModule {}
