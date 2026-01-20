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
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
} from './dto/create-inventory-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('organisations/:organisationId/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) { }

  @Post()
  @Roles(UserRole.CLINIC, UserRole.MANUFACTURER, UserRole.ADMIN)
  create(
    @Param('organisationId') organisationId: string,
    @Body() createInventoryItemDto: CreateInventoryItemDto,
  ) {
    console.log('[Inventory Controller] Creating item:', {
      organisationId,
      dto: createInventoryItemDto,
      hasProductId: 'productId' in createInventoryItemDto,
    });
    return this.inventoryService.create(organisationId, createInventoryItemDto);
  }

  @Get()
  findAll(@Param('organisationId') organisationId: string) {
    return this.inventoryService.findAll(organisationId);
  }

  @Get('low-stock')
  checkLowStock(@Param('organisationId') organisationId: string) {
    return this.inventoryService.checkLowStock(organisationId);
  }

  @Get(':id')
  findOne(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.inventoryService.findOne(organisationId, id);
  }

  @Patch(':id')
  @Roles(UserRole.CLINIC, UserRole.MANUFACTURER, UserRole.ADMIN)
  update(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() updateInventoryItemDto: UpdateInventoryItemDto,
  ) {
    console.log('[Inventory Controller] Updating item:', {
      organisationId,
      id,
      dto: updateInventoryItemDto,
      hasProductId: 'productId' in updateInventoryItemDto,
    });
    return this.inventoryService.update(
      organisationId,
      id,
      updateInventoryItemDto,
    );
  }

  @Delete(':id')
  @Roles(UserRole.CLINIC, UserRole.MANUFACTURER, UserRole.ADMIN)
  remove(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.inventoryService.remove(organisationId, id);
  }
}
