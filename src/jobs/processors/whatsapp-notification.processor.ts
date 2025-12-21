import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';

@Processor('whatsapp-notification')
export class WhatsAppNotificationProcessor extends WorkerHost {
  constructor(private whatsappService: WhatsAppService) {
    super();
  }

  async process(job: Job<{ phoneNumber: string; message: string }>) {
    const { phoneNumber, message } = job.data;
    await this.whatsappService.sendMessage(phoneNumber, message);
  }
}

