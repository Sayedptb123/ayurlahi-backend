import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { Dispute } from '../disputes/entities/dispute.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, User, Organisation, Dispute])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule { }
