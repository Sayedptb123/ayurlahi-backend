import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetOrdersDto } from './dto/get-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async findAll(@Request() req, @Query() query: GetOrdersDto) {
    return this.ordersService.findAll(req.user.userId, req.user.role, query);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    return this.ordersService.findOne(id, req.user.userId, req.user.role);
  }

  @Post()
  async create(@Request() req, @Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(req.user.userId, createOrderDto);
  }

  @Post(':id/reorder')
  async reorder(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    return this.ordersService.reorder(id, req.user.userId);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() updateDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(
      id,
      req.user.userId,
      req.user.role,
      updateDto,
    );
  }
}





