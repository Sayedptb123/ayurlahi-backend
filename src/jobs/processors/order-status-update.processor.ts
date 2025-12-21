import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OrdersService } from '../../orders/orders.service';
import { OrderStatus } from '../../common/enums/order-status.enum';

@Processor('order-status-update')
export class OrderStatusUpdateProcessor extends WorkerHost {
  constructor(private ordersService: OrdersService) {
    super();
  }

  async process(job: Job<{ orderId: string; status: OrderStatus }>) {
    const { orderId, status } = job.data;
    await this.ordersService.updateStatus(orderId, status);
  }
}

