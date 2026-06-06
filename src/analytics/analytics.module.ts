import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { PatientBill } from '../patient-billing/entities/patient-bill.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { UsageEvent } from './entities/usage-event.entity';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchase-orders/entities/purchase-order-item.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';
import { Admission } from '../retreat/entities/admission.entity';
import { Room } from '../retreat/entities/room.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order, User, Organisation, Dispute,
      Patient, Appointment, PatientBill, Expense, UsageEvent,
      PurchaseOrder, PurchaseOrderItem, OrderItem, InventoryItem, StockMovement,
      Admission, Room,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule { }
