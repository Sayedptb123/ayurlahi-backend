import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { GetInvoicesDto } from './dto/get-invoices.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  async findAll(@Request() req, @Query() query: GetInvoicesDto) {
    return this.invoicesService.findAll(req.user.userId, req.user.role, query);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    return this.invoicesService.findOne(id, req.user.userId, req.user.role);
  }

  @Get(':id/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const invoice = await this.invoicesService.findOne(
      id,
      req.user.userId,
      req.user.role,
    );

    // Redirect to S3 URL or stream the file
    // For now, redirect to the S3 URL
    if (invoice.s3Url) {
      return res.redirect(invoice.s3Url);
    }

    throw new Error('Invoice file not found');
  }
}

