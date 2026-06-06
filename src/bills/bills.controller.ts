import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { BillsService } from './bills.service';
import { CreateRecurringBillDto } from './dto/create-recurring-bill.dto';
import { UpdateRecurringBillDto } from './dto/update-recurring-bill.dto';
import { LogBillPaymentDto } from './dto/log-bill-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

const CLINIC_MEMBERS = [
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.ADMIN,
  UserRole.CLINIC,
  UserRole.MANUFACTURER,
];

@Controller('bills')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @Post()
  @Roles(...CLINIC_MEMBERS)
  create(@Body() createDto: CreateRecurringBillDto, @Request() req) {
    return this.billsService.create(createDto, req.user);
  }

  @Get()
  @Roles(...CLINIC_MEMBERS)
  findAll(@Request() req, @Query('isActive') isActive?: string) {
    return this.billsService.findAll(req.user, { isActive });
  }

  @Post('process-due')
  @Roles(...CLINIC_MEMBERS)
  processDue(@Request() req) {
    return this.billsService.processDueBillsManual(req.user);
  }

  @Get(':id')
  @Roles(...CLINIC_MEMBERS)
  findOne(@Param('id') id: string, @Request() req) {
    return this.billsService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(...CLINIC_MEMBERS)
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateRecurringBillDto,
    @Request() req,
  ) {
    return this.billsService.update(id, updateDto, req.user);
  }

  @Delete(':id')
  @Roles(...CLINIC_MEMBERS)
  remove(@Param('id') id: string, @Request() req) {
    return this.billsService.remove(id, req.user);
  }

  @Get(':id/payments')
  @Roles(...CLINIC_MEMBERS)
  getPayments(@Param('id') id: string, @Request() req) {
    return this.billsService.getPayments(id, req.user);
  }

  @Post(':id/payments')
  @Roles(...CLINIC_MEMBERS)
  logPayment(
    @Param('id') id: string,
    @Body() logDto: LogBillPaymentDto,
    @Request() req,
  ) {
    return this.billsService.logPayment(id, logDto, req.user);
  }
}
