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
import { PurchaseOrdersService } from './purchase-orders.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './dto/create-purchase-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganisationGuard } from '../auth/guards/organisation.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('organisations/:organisationId/purchase-orders')
@UseGuards(JwtAuthGuard, OrganisationGuard, RolesGuard)
export class PurchaseOrdersController {
  constructor(private readonly poService: PurchaseOrdersService) {}

  @Post()
  @Roles(UserRole.CLINIC, UserRole.MANUFACTURER, UserRole.ADMIN)
  create(
    @Param('organisationId') organisationId: string,
    @Body() createDto: CreatePurchaseOrderDto,
    @Request() req,
  ) {
    // Was req.user.id (pre-existing bug -- JwtStrategy sets userId, not
    // id, so created_by was always saved null). Fixed in passing since
    // this line needed touching anyway to add role for branch resolution.
    return this.poService.create(organisationId, createDto, req.user.userId, req.user.role);
  }

  @Get()
  findAll(@Param('organisationId') organisationId: string) {
    return this.poService.findAll(organisationId);
  }

  @Get(':id')
  findOne(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.poService.findOne(organisationId, id);
  }

  @Patch(':id')
  @Roles(UserRole.CLINIC, UserRole.MANUFACTURER, UserRole.ADMIN)
  update(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdatePurchaseOrderDto,
    @Request() req,
  ) {
    // T26: userId/role are needed so a transition to 'received' can apply
    // the stricter receive-only authorization + branch check inside the
    // service, on top of this decorator's org-membership-level gate.
    return this.poService.update(organisationId, id, updateDto, req.user.userId, req.user.role);
  }

  @Delete(':id')
  @Roles(UserRole.CLINIC, UserRole.MANUFACTURER, UserRole.ADMIN)
  remove(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.poService.remove(organisationId, id);
  }
}
