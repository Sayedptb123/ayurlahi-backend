import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { RazorpayService } from '../razorpay/razorpay.service';

@Controller('webhooks/razorpay')
export class RazorpayWebhookController {
  constructor(
    private paymentsService: PaymentsService,
    private razorpayService: RazorpayService,
  ) {}

  @Post('payment')
  @HttpCode(HttpStatus.OK)
  async handlePaymentWebhook(
    @Body() body: any,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('Webhook secret not configured');
    }
    const payload = JSON.stringify(body);

    const isValid = this.razorpayService.verifyWebhookSignature(
      payload,
      signature,
      webhookSecret,
    );

    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    const event = body.event;
    const paymentEntity = body.payload.payment?.entity;

    if (event === 'payment.captured' && paymentEntity) {
      // Find payment by Razorpay order ID
      const payment = await this.paymentsService.findByRazorpayOrderId(
        paymentEntity.order_id,
      );

      if (payment) {
        await this.paymentsService.verifyAndCapturePayment(
          payment.id,
          paymentEntity.id,
          signature,
        );
      }
    } else if (event === 'payment.failed' && paymentEntity) {
      // Handle payment failure
      const payment = await this.paymentsService.findByRazorpayOrderId(
        paymentEntity.order_id,
      );

      if (payment) {
        await this.paymentsService.verifyAndCapturePayment(
          payment.id,
          paymentEntity.id,
          signature,
        );
      }
    }

    return { received: true };
  }
}

