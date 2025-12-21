import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { OrderStatus } from '../common/enums/order-status.enum';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLINIC)
  create(@Body() createOrderDto: CreateOrderDto, @CurrentUser() user: User) {
    return this.ordersService.create(user.id, createOrderDto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query('clinicId') clinicId?: string,
  ) {
    if (user.role === UserRole.CLINIC) {
      const clinic = await this.ordersService['clinicsService'].findByUserId(user.id);
      return this.ordersService.findAll(clinic.id);
    } else if (user.role === UserRole.MANUFACTURER) {
      const manufacturer = await this.ordersService['manufacturersService'].findByUserId(user.id);
      return this.ordersService.findAll(undefined, manufacturer.id);
    }
    return this.ordersService.findAll(clinicId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT, UserRole.MANUFACTURER)
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: OrderStatus },
    @CurrentUser() user: User,
  ) {
    return this.ordersService.updateStatus(id, body.status, user.id);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLINIC, UserRole.ADMIN)
  cancel(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: User,
  ) {
    return this.ordersService.cancel(id, body.reason, user.id);
  }

  @Patch(':orderId/items/:itemId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANUFACTURER, UserRole.ADMIN, UserRole.SUPPORT)
  updateOrderItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() updateDto: UpdateOrderItemDto,
  ) {
    return this.ordersService.updateOrderItem(orderId, itemId, updateDto);
  }
}

