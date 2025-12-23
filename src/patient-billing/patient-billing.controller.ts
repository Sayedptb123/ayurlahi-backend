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
  ParseUUIDPipe,
} from '@nestjs/common';
import { PatientBillingService } from './patient-billing.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { PaymentDto } from './dto/payment.dto';
import { GetBillsDto } from './dto/get-bills.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('patient-billing')
@UseGuards(JwtAuthGuard)
export class PatientBillingController {
  constructor(
    private readonly patientBillingService: PatientBillingService,
  ) {}

  @Post()
  create(@Request() req, @Body() createDto: CreateBillDto) {
    return this.patientBillingService.create(
      req.user.userId,
      req.user.role,
      createDto,
    );
  }

  @Get()
  findAll(@Request() req, @Query() query: GetBillsDto) {
    return this.patientBillingService.findAll(
      req.user.userId,
      req.user.role,
      query,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.patientBillingService.findOne(
      id,
      req.user.userId,
      req.user.role,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() updateDto: UpdateBillDto,
  ) {
    return this.patientBillingService.update(
      id,
      req.user.userId,
      req.user.role,
      updateDto,
    );
  }

  @Post(':id/payment')
  recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() paymentDto: PaymentDto,
  ) {
    return this.patientBillingService.recordPayment(
      id,
      req.user.userId,
      req.user.role,
      paymentDto,
    );
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.patientBillingService.remove(
      id,
      req.user.userId,
      req.user.role,
    );
  }
}

