import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';

@Controller('webhooks/whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Post('incoming')
  @HttpCode(HttpStatus.OK)
  async handleIncomingMessage(@Body() body: any) {
    const { from, message, messageId } = body;

    const response = await this.whatsappService.handleIncomingMessage(
      from,
      message,
      messageId,
    );

    return { response };
  }
}





