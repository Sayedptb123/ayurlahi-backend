import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InvoicesService } from '../../invoices/invoices.service';

@Processor('invoice-generation')
export class InvoiceGenerationProcessor extends WorkerHost {
  constructor(private invoicesService: InvoicesService) {
    super();
  }

  async process(job: Job<{ orderId: string }>) {
    const { orderId } = job.data;
    await this.invoicesService.generateInvoice(orderId);
  }
}

