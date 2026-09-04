import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetOrdersDto } from './dto/get-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AssignOrderItemDto } from './dto/assign-order-item.dto';
import { CreateExternalOrderDto } from './dto/create-external-order.dto';
import { GrantExternalOrderAccessDto } from './dto/grant-external-order-access.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

function requireTeam(req: any) {
  if (req.user?.organisationType !== 'AYURLAHI_TEAM') {
    throw new ForbiddenException('Only Ayurlahi Team members can perform this action');
  }
}

function requireManufacturer(req: any) {
  if (req.user?.organisationType !== 'MANUFACTURER' || !req.user?.organisationId) {
    throw new ForbiddenException('Only manufacturer users can perform this action');
  }
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

  // --- External orders (manufacturer-entered WhatsApp/phone orders) ---
  // Declared before the parameterized routes below (:id) so these literal
  // paths match first.

  @Get('external/accessible-clinics')
  async getAccessibleClinics(@Request() req) {
    requireManufacturer(req);
    return this.ordersService.getAccessibleClinicsForManufacturer(req.user.organisationId);
  }

  @Get('external/accessible-clinics/:clinicId/branches')
  async getAccessibleClinicBranches(@Param('clinicId', ParseUUIDPipe) clinicId: string, @Request() req) {
    requireManufacturer(req);
    return this.ordersService.getAccessibleClinicBranches(req.user.organisationId, clinicId);
  }

  @Post('external')
  async createExternalOrder(@Request() req, @Body() dto: CreateExternalOrderDto) {
    requireManufacturer(req);
    return this.ordersService.createExternalOrder(req.user.userId, req.user.organisationId, dto);
  }

  // --- Team-only management of which clinics a manufacturer may create external orders for ---

  @Post('external/access')
  async grantExternalOrderAccess(@Request() req, @Body() dto: GrantExternalOrderAccessDto) {
    requireTeam(req);
    return this.ordersService.grantExternalOrderAccess(req.user.userId, dto);
  }

  @Get('external/access')
  async listExternalOrderAccessGrants(@Request() req, @Query('manufacturerId') manufacturerId?: string) {
    requireTeam(req);
    return this.ordersService.listExternalOrderAccessGrants(manufacturerId);
  }

  @Delete('external/access/:id')
  async revokeExternalOrderAccess(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    requireTeam(req);
    return this.ordersService.revokeExternalOrderAccess(id);
  }

  @Get()
  async findAll(@Request() req, @Query() query: GetOrdersDto) {
    return this.ordersService.findAll(req.user.userId, req.user.role, req.user.organisationType, query, req.user.organisationId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.ordersService.findOne(id, req.user.userId, req.user.role, req.user.organisationType, req.user.organisationId);
  }

  @Post()
  async create(@Request() req, @Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(req.user.userId, createOrderDto, req.user.organisationType, req.user.organisationId);
  }

  @Post(':id/reorder')
  async reorder(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.ordersService.reorder(id, req.user.userId, req.user.organisationId);
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
      req.user.organisationType,
      updateDto,
      req.user.organisationId,
    );
  }

  @Patch(':orderId/items/:itemId/assign')
  async assignItem(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Request() req,
    @Body() assignDto: AssignOrderItemDto,
  ) {
    return this.ordersService.assignOrderItem(
      orderId,
      itemId,
      req.user.userId,
      req.user.role,
      req.user.organisationType,
      req.user.organisationId,
      assignDto,
    );
  }

  @Patch(':orderId/items/:itemId/pickup')
  async pickupItem(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Request() req,
  ) {
    return this.ordersService.markItemPickedUp(
      orderId,
      itemId,
      req.user.userId,
      req.user.role,
      req.user.organisationType,
      req.user.organisationId,
    );
  }
}
