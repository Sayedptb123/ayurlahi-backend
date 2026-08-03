import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchCatalogController } from './branch-catalog.controller';
import { BranchCatalogService } from './branch-catalog.service';
import { RoomCategory } from '../retreat/entities/room-category.entity';
import { TreatmentPackage } from '../retreat/entities/treatment-package.entity';
import { RoomCategoryPricing } from '../retreat/entities/room-category-pricing.entity';
import { RoomPricingOverride } from '../retreat/entities/room-pricing-override.entity';
import { DutyType } from '../duty-types/entities/duty-type.entity';
import { DutyTemplate } from '../duty-templates/entities/duty-template.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoomCategory,
      TreatmentPackage,
      RoomCategoryPricing,
      RoomPricingOverride,
      DutyType,
      DutyTemplate,
    ]),
  ],
  controllers: [BranchCatalogController],
  providers: [BranchCatalogService],
})
export class BranchCatalogModule {}
