import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OrdersService } from '../orders/orders.service';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { OrderSource } from '../common/enums/order-source.enum';
import { ClinicsService } from '../clinics/clinics.service';

@Injectable()
export class WhatsAppService {
  private apiUrl: string;
  private apiKey: string;
  private sourceName: string;

  constructor(
    private configService: ConfigService,
    private ordersService: OrdersService,
    private clinicsService: ClinicsService,
  ) {
    this.apiUrl = this.configService.get<string>('WHATSAPP_API_URL') || '';
    this.apiKey = this.configService.get<string>('WHATSAPP_API_KEY') || '';
    this.sourceName = this.configService.get<string>('WHATSAPP_SOURCE_NAME') || '';
    
    if (!this.apiUrl || !this.apiKey || !this.sourceName) {
      console.warn('WhatsApp configuration incomplete. WhatsApp features may not work.');
    }
  }

  async sendMessage(to: string, message: string): Promise<void> {
    try {
      await axios.post(
        `${this.apiUrl}/messages`,
        {
          source: this.sourceName,
          destination: to,
          message: {
            type: 'text',
            text: message,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            apikey: this.apiKey,
          },
        },
      );
    } catch (error) {
      throw new BadRequestException(
        `Failed to send WhatsApp message: ${error.message}`,
      );
    }
  }

  async sendMenu(phoneNumber: string): Promise<void> {
    const menuMessage = `
🏥 *Ayurlahi Order Menu*

Please select an option:
1️⃣ Browse Products
2️⃣ View Cart
3️⃣ Place Order
4️⃣ Order History
5️⃣ Help

Reply with the number to continue.
    `.trim();

    await this.sendMessage(phoneNumber, menuMessage);
  }

  async handleIncomingMessage(
    from: string,
    message: string,
    messageId: string,
  ): Promise<string> {
    // Find clinic by WhatsApp number
    const clinic = await this.clinicsService['clinicsRepository'].findOne({
      where: { whatsappNumber: from },
      relations: ['user'],
    });

    if (!clinic) {
      return 'Clinic not found. Please contact support.';
    }

    // Simple menu-based flow
    const trimmedMessage = message.trim().toLowerCase();

    if (trimmedMessage === '1' || trimmedMessage === 'menu') {
      await this.sendMenu(from);
      return 'Menu sent';
    }

    // Handle order creation (simplified - in production, use a state machine)
    if (trimmedMessage.startsWith('order:')) {
      try {
        // Parse order from message (format: order:productId1:qty1,productId2:qty2)
        const orderData = trimmedMessage.replace('order:', '');
        const items = orderData.split(',').map((item) => {
          const [productId, quantity] = item.split(':');
          return {
            productId: productId.trim(),
            quantity: parseInt(quantity.trim(), 10),
          };
        });

        const createOrderDto: CreateOrderDto = {
          items,
          source: OrderSource.WHATSAPP,
          whatsappMessageId: messageId,
        };

        const order = await this.ordersService.create(
          clinic.user.id,
          createOrderDto,
        );

        return `Order created: ${order.orderNumber}. Total: ₹${order.totalAmount}. Please proceed to payment.`;
      } catch (error) {
        return `Error creating order: ${error.message}`;
      }
    }

    return 'Invalid command. Send "menu" to see options.';
  }

  async sendOrderConfirmation(phoneNumber: string, orderNumber: string): Promise<void> {
    const message = `
✅ *Order Confirmed*

Order Number: ${orderNumber}
Your order has been placed successfully.

You will receive payment link shortly.
    `.trim();

    await this.sendMessage(phoneNumber, message);
  }
}

