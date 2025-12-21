import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Refund } from './entities/refund.entity';
import { RefundStatus } from '../common/enums/refund-status.enum';
import { RefundReason } from '../common/enums/refund-reason.enum';
import { RazorpayService } from '../razorpay/razorpay.service';
import { PaymentsService } from '../payments/payments.service';
import { OrdersService } from '../orders/orders.service';
import { OrderStatus } from '../common/enums/order-status.enum';

@Injectable()
export class RefundsService {
  constructor(
    @InjectRepository(Refund)
    private refundsRepository: Repository<Refund>,
    private razorpayService: RazorpayService,
    private paymentsService: PaymentsService,
    private ordersService: OrdersService,
  ) {}

  async create(
    orderId: string,
    reason: RefundReason,
    amount?: number,
    notes?: string,
    initiatedBy?: string,
  ): Promise<Refund> {
    const order = await this.ordersService.findOne(orderId);
    const payment = await this.paymentsService.findByOrderId(orderId);

    if (payment.status !== 'captured') {
      throw new BadRequestException('Payment must be captured to process refund');
    }

    const refundAmount = amount
      ? Math.round(amount * 100)
      : Math.round(order.totalAmount * 100);

    // Create Razorpay refund
    const razorpayRefund = await this.razorpayService.createRefund({
      paymentId: payment.razorpayPaymentId,
      amount: refundAmount,
      notes: notes ? { orderId, reason, notes } : { orderId, reason },
    });

    // Create refund record
    const refund = this.refundsRepository.create({
      orderId: order.id,
      paymentId: payment.id,
      razorpayRefundId: razorpayRefund.id,
      status: RefundStatus.PROCESSING,
      reason,
      amount: refundAmount,
      currency: 'INR',
      notes,
      initiatedBy,
      razorpayResponse: razorpayRefund as any,
      splitRefundDetails: {
        platform: Math.round(order.platformFee * 100),
        manufacturers: await this.calculateManufacturerRefunds(order, refundAmount),
      },
    });

    const savedRefund = await this.refundsRepository.save(refund);

    // Update order status
    if (refundAmount === Math.round(order.totalAmount * 100)) {
      await this.ordersService.updateStatus(orderId, OrderStatus.REFUNDED);
    } else {
      await this.ordersService.updateStatus(
        orderId,
        OrderStatus.PARTIALLY_FULFILLED,
      );
    }

    return savedRefund;
  }

  async updateRefundStatus(
    refundId: string,
    status: RefundStatus,
    razorpayRefund?: any,
  ): Promise<Refund> {
    const refund = await this.refundsRepository.findOne({
      where: { id: refundId },
    });

    if (!refund) {
      throw new NotFoundException(`Refund with ID ${refundId} not found`);
    }

    refund.status = status;

    if (status === RefundStatus.COMPLETED) {
      refund.processedAt = new Date();
      if (razorpayRefund) {
        refund.razorpayResponse = razorpayRefund;
      }
    } else if (status === RefundStatus.FAILED) {
      refund.failedAt = new Date();
      refund.failureReason = razorpayRefund?.error_description || 'Refund failed';
    }

    return this.refundsRepository.save(refund);
  }

  private async calculateManufacturerRefunds(
    order: any,
    refundAmount: number,
  ): Promise<any[]> {
    // Calculate proportional refunds for manufacturers
    const totalOrderAmount = Math.round(order.totalAmount * 100);
    const refundRatio = refundAmount / totalOrderAmount;

    const manufacturerRefunds: any[] = [];
    const manufacturerGroups = new Map();

    for (const item of order.items) {
      if (!manufacturerGroups.has(item.manufacturerId)) {
        manufacturerGroups.set(item.manufacturerId, {
          manufacturerId: item.manufacturerId,
          amount: 0,
        });
      }
      const group = manufacturerGroups.get(item.manufacturerId);
      const itemAmount =
        Math.round(item.totalAmount * 100) - Math.round(item.commissionAmount * 100);
      group.amount += Math.round(itemAmount * refundRatio);
    }

    for (const [manufacturerId, group] of manufacturerGroups) {
      manufacturerRefunds.push({
        manufacturerId,
        amount: group.amount,
      });
    }

    return manufacturerRefunds;
  }

  async findAll(): Promise<Refund[]> {
    return this.refundsRepository.find({
      relations: ['order', 'payment'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Refund> {
    const refund = await this.refundsRepository.findOne({
      where: { id },
      relations: ['order', 'payment'],
    });

    if (!refund) {
      throw new NotFoundException(`Refund with ID ${id} not found`);
    }

    return refund;
  }

  async findByOrderId(orderId: string): Promise<Refund[]> {
    return this.refundsRepository.find({
      where: { orderId },
      relations: ['order', 'payment'],
      order: { createdAt: 'DESC' },
    });
  }
}

