import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionsService } from './promotions.service';
import { PromotionsController } from './promotions.controller';
import { Promotion } from './entities/promotion.entity';
import { PromotionEvent } from './entities/promotion-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Promotion, PromotionEvent])],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
