import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Payment } from './entities/payment.entity';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { RazorpayService } from '../razorpay/razorpay.service';
import { OrdersService } from '../orders/orders.service';
import { OrderStatus } from '../common/enums/order-status.enum';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    private razorpayService: RazorpayService,
    private ordersService: OrdersService,
    @InjectQueue('invoice-generation')
    private invoiceQueue: Queue,
  ) {}

  async initiatePayment(orderId: string): Promise<Payment> {
    const order = await this.ordersService.findOne(orderId);

    if (order.payment) {
      throw new BadRequestException('Payment already initiated for this order');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Cannot initiate payment for order in ${order.status} status`,
      );
    }

    // Create Razorpay order
    const razorpayOrder = await this.razorpayService.createOrder({
      amount: Math.round(order.totalAmount * 100), // Convert to paise
      currency: 'INR',
      receipt: order.orderNumber,
      notes: {
        orderId: order.id,
        clinicId: order.clinicId,
      },
      // Split payment configuration
      splitPayment: {
        transfers: await this.calculateSplitPayments(order),
      },
    });

    // Create payment record
    const payment = this.paymentsRepository.create({
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      status: PaymentStatus.INITIATED,
      amount: Math.round(order.totalAmount * 100),
      currency: 'INR',
      razorpayResponse: razorpayOrder as any,
      splitDetails: {
        platform: Math.round(order.platformFee * 100),
        manufacturers: await this.calculateManufacturerSplits(order),
      },
    });

    const savedPayment = await this.paymentsRepository.save(payment);

    // Update order with Razorpay order ID
    await this.ordersService['ordersRepository'].update(order.id, {
      razorpayOrderId: razorpayOrder.id,
      status: OrderStatus.PAYMENT_PENDING,
    });

    return savedPayment;
  }

  async verifyAndCapturePayment(
    paymentId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }
    const payload = JSON.stringify({
      payment_id: razorpayPaymentId,
      order_id: payment.razorpayOrderId,
    });

    const isValid = this.razorpayService.verifyWebhookSignature(
      payload,
      razorpaySignature,
      webhookSecret,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid payment signature');
    }

    // Fetch payment details from Razorpay
    const razorpayPayment = await this.razorpayService.getPayment(
      razorpayPaymentId,
    );

    if (razorpayPayment.status === 'captured') {
      payment.status = PaymentStatus.CAPTURED;
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = razorpaySignature;
      payment.method = razorpayPayment.method || null;
      payment.bank = razorpayPayment.bank || null;
      payment.wallet = razorpayPayment.wallet || null;
      payment.vpa = razorpayPayment.vpa || null;
      payment.cardId = razorpayPayment.card_id || null;
      payment.capturedAt = new Date();
      payment.razorpayResponse = razorpayPayment as any;

      await this.paymentsRepository.save(payment);

      // Update order status
      await this.ordersService.updateStatus(
        payment.orderId,
        OrderStatus.CONFIRMED,
      );

      // Queue invoice generation
      await this.invoiceQueue.add('generate-invoice', {
        orderId: payment.orderId,
      });
    } else if (razorpayPayment.status === 'failed') {
      payment.status = PaymentStatus.FAILED;
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.failedAt = new Date();
      payment.failureReason = razorpayPayment.error_description || 'Payment failed';
      payment.razorpayResponse = razorpayPayment as any;

      await this.paymentsRepository.save(payment);

      // Update order status
      await this.ordersService.updateStatus(
        payment.orderId,
        OrderStatus.PAYMENT_FAILED,
      );
    }

    return payment;
  }

  private async calculateSplitPayments(order: any): Promise<any[]> {
    // Calculate split payments for manufacturers
    // This is a simplified version - you may need to adjust based on your Razorpay account setup
    const transfers: any[] = [];

    // Group items by manufacturer
    const manufacturerGroups = new Map();
    for (const item of order.items) {
      if (!manufacturerGroups.has(item.manufacturerId)) {
        manufacturerGroups.set(item.manufacturerId, {
          manufacturerId: item.manufacturerId,
          amount: 0,
        });
      }
      const group = manufacturerGroups.get(item.manufacturerId);
      group.amount += Math.round(item.totalAmount * 100) - Math.round(item.commissionAmount * 100);
    }

    // Create transfers (requires Razorpay account IDs for manufacturers)
    // Note: This is a placeholder - actual implementation requires manufacturer Razorpay account IDs
    for (const [manufacturerId, group] of manufacturerGroups) {
      // transfers.push({
      //   account: manufacturerRazorpayAccountId,
      //   amount: group.amount,
      //   currency: 'INR',
      // });
    }

    return transfers;
  }

  private async calculateManufacturerSplits(order: any): Promise<any[]> {
    const splits: any[] = [];
    const manufacturerGroups = new Map();

    for (const item of order.items) {
      if (!manufacturerGroups.has(item.manufacturerId)) {
        manufacturerGroups.set(item.manufacturerId, {
          manufacturerId: item.manufacturerId,
          amount: 0,
        });
      }
      const group = manufacturerGroups.get(item.manufacturerId);
      group.amount += Math.round(item.totalAmount * 100) - Math.round(item.commissionAmount * 100);
    }

    for (const [manufacturerId, group] of manufacturerGroups) {
      splits.push({
        manufacturerId,
        amount: group.amount,
      });
    }

    return splits;
  }

  async findOne(id: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  async findByOrderId(orderId: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { orderId },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment for order ${orderId} not found`);
    }

    return payment;
  }

  async findByRazorpayOrderId(razorpayOrderId: string): Promise<Payment | null> {
    return this.paymentsRepository.findOne({
      where: { razorpayOrderId },
      relations: ['order'],
    });
  }
}

