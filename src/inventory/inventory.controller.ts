import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
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
import { OrganisationGuard } from '../auth/guards/organisation.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('organisations/:organisationId/inventory')
@UseGuards(JwtAuthGuard, OrganisationGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) { }

  @Post()
  @Roles(UserRole.CLINIC, UserRole.MANUFACTURER, UserRole.ADMIN)
  create(
    @Param('organisationId') organisationId: string,
    @Body() createInventoryItemDto: CreateInventoryItemDto,
    @Request() req,
  ) {
    return this.inventoryService.create(
      organisationId,
      createInventoryItemDto,
      req.user.userId,
      req.user.role,
    );
  }

  @Get()
  findAll(
    @Param('organisationId') organisationId: string,
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.inventoryService.findAll(
      organisationId,
      {
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        category,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        branchId,
      },
      req.user?.userId,
      req.user?.role,
    );
  }

  @Get('low-stock')
  checkLowStock(
    @Param('organisationId') organisationId: string,
    @Request() req,
    @Query('branchId') branchId?: string,
  ) {
    return this.inventoryService.checkLowStock(organisationId, req.user?.userId, req.user?.role, branchId);
  }

  @Get(':id')
  findOne(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Request() req,
    @Query('branchId') branchId?: string,
  ) {
    return this.inventoryService.findOne(organisationId, id, req.user?.userId, req.user?.role, branchId);
  }

  // Phase 24C.1 — stock-movement history for one item
  @Get(':id/movements')
  getMovements(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Request() req,
    @Query('branchId') branchId?: string,
  ) {
    return this.inventoryService.getMovements(organisationId, id, req.user?.userId, req.user?.role, branchId);
  }

  @Patch(':id')
  @Roles(UserRole.CLINIC, UserRole.MANUFACTURER, UserRole.ADMIN)
  update(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() updateInventoryItemDto: UpdateInventoryItemDto,
    @Request() req,
  ) {
    return this.inventoryService.update(
      organisationId,
      id,
      updateInventoryItemDto,
      req.user.userId,
      req.user.role,
    );
  }

  @Delete(':id')
  @Roles(UserRole.CLINIC, UserRole.MANUFACTURER, UserRole.ADMIN)
  remove(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Request() req,
    @Query('branchId') branchId?: string,
  ) {
    return this.inventoryService.remove(organisationId, id, req.user.userId, req.user.role, branchId);
  }
}
