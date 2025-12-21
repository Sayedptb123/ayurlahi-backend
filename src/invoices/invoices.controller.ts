import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import type { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: 'paid' | 'pending' | 'overdue' | 'cancelled',
    @Query('orderId') orderId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.invoicesService.findAll(user.id, user.role, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      orderId,
      startDate,
      endDate,
    });
  }

  @Get('order/:orderId')
  async findByOrderId(@Param('orderId') orderId: string, @CurrentUser() user: User) {
    const invoice = await this.invoicesService.findByOrderId(orderId);
    const hasAccess = await this.invoicesService.checkAccess(user.id, user.role, invoice.id);
    if (!hasAccess) {
      throw new ForbiddenException('You don\'t have permission to access this invoice');
    }
    return invoice;
  }

  @Get(':id/download')
  async downloadInvoice(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const hasAccess = await this.invoicesService.checkAccess(user.id, user.role, id);
    if (!hasAccess) {
      throw new ForbiddenException('You don\'t have permission to download this invoice');
    }

    const invoice = await this.invoicesService.findOne(id);
    const pdfBuffer = await this.invoicesService.downloadInvoicePdf(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
    );
    res.send(pdfBuffer);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    const hasAccess = await this.invoicesService.checkAccess(user.id, user.role, id);
    if (!hasAccess) {
      throw new ForbiddenException('You don\'t have permission to access this invoice');
    }
    return this.invoicesService.findOne(id);
  }

  @Post('generate/:orderId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  async generateInvoice(@Param('orderId') orderId: string) {
    return this.invoicesService.generateInvoice(orderId);
  }
}




