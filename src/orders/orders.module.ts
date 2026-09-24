import { BranchVisibilityModule } from '../branch-visibility/branch-visibility.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { ManufacturerExternalOrderAccess } from './entities/manufacturer-external-order-access.entity';
import { OrderReplacement } from './entities/order-replacement.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { Branch } from '../branches/entities/branch.entity';

import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, ManufacturerExternalOrderAccess, OrderReplacement, Product, User, OrganisationUser, Invoice, Dispute, Branch]),
    BranchVisibilityModule,
    InventoryModule,
    NotificationsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule { }
