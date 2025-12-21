import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import { CreateOrderDto } from './dto/create-razorpay-order.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';

@Injectable()
export class RazorpayService {
  private razorpay: Razorpay | null = null;

  constructor(private configService: ConfigService) {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    
    if (keyId && keySecret) {
      this.razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    } else {
      console.warn('Razorpay credentials not configured. Payment features will be disabled.');
    }
  }

  private ensureRazorpayInitialized(): void {
    if (!this.razorpay) {
      throw new BadRequestException('Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    }
  }

  async createOrder(createOrderDto: CreateOrderDto) {
    this.ensureRazorpayInitialized();
    try {
      const order = await this.razorpay!.orders.create({
        amount: createOrderDto.amount, // Amount in paise
        currency: createOrderDto.currency || 'INR',
        receipt: createOrderDto.receipt,
        notes: createOrderDto.notes,
        ...(createOrderDto.splitPayment && {
          transfers: createOrderDto.splitPayment.transfers,
        }),
      });

      return order;
    } catch (error) {
      throw new BadRequestException(
        `Razorpay order creation failed: ${error.message}`,
      );
    }
  }

  async createPayment(createPaymentDto: CreatePaymentDto) {
    try {
      // Note: Razorpay payments are created client-side, not server-side
      // This method is kept for potential server-side payment creation scenarios
      // For standard flow, payments are created via Razorpay Checkout
      throw new BadRequestException(
        'Server-side payment creation not supported. Use Razorpay Checkout.',
      );
    } catch (error) {
      throw new BadRequestException(
        `Razorpay payment creation failed: ${error.message}`,
      );
    }
  }

  async capturePayment(paymentId: string, amount: number, currency: string = 'INR') {
    this.ensureRazorpayInitialized();
    try {
      const payment = await this.razorpay!.payments.capture(paymentId, amount, currency);
      return payment;
    } catch (error) {
      throw new BadRequestException(
        `Razorpay payment capture failed: ${error.message}`,
      );
    }
  }

  async createRefund(createRefundDto: CreateRefundDto) {
    this.ensureRazorpayInitialized();
    try {
      const refund = await this.razorpay!.payments.refund(
        createRefundDto.paymentId,
        {
          amount: createRefundDto.amount,
          notes: createRefundDto.notes,
          ...(createRefundDto.speed && { speed: createRefundDto.speed }),
        },
      );

      return refund;
    } catch (error) {
      throw new BadRequestException(
        `Razorpay refund creation failed: ${error.message}`,
      );
    }
  }

  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  async getPayment(paymentId: string) {
    this.ensureRazorpayInitialized();
    try {
      const payment = await this.razorpay!.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch payment: ${error.message}`,
      );
    }
  }

  async getOrder(orderId: string) {
    this.ensureRazorpayInitialized();
    try {
      const order = await this.razorpay!.orders.fetch(orderId);
      return order;
    } catch (error) {
      throw new BadRequestException(`Failed to fetch order: ${error.message}`);
    }
  }
}

