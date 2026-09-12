import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryItemMaster } from './entities/inventory-item-master.entity';
import { InventoryBranchStock } from './entities/inventory-branch-stock.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { Branch } from '../branches/entities/branch.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { Product } from '../products/entities/product.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { BranchVisibilityModule } from '../branch-visibility/branch-visibility.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItem, // legacy -- kept registered for reference only, no longer written to (ADR-005 Step 3)
      InventoryItemMaster,
      InventoryBranchStock,
      StockMovement,
      Branch,
      OrganisationUser,
      Product,
    ]),
    NotificationsModule,
    BranchVisibilityModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
