import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryItemMaster } from '../inventory/entities/inventory-item-master.entity';
import { InventoryBranchStock } from '../inventory/entities/inventory-branch-stock.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';
import { BranchVisibilityModule } from '../branch-visibility/branch-visibility.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseOrder,
      PurchaseOrderItem,
      InventoryItem,
      InventoryItemMaster,
      InventoryBranchStock,
      StockMovement,
    ]),
    BranchVisibilityModule,
  ],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
