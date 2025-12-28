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
import { SuppliersService } from './suppliers.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
} from './dto/create-supplier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('organisations/:organisationId/suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)
  create(
    @Param('organisationId') organisationId: string,
    @Body() createSupplierDto: CreateSupplierDto,
  ) {
    return this.suppliersService.create(organisationId, createSupplierDto);
  }

  @Get()
  findAll(@Param('organisationId') organisationId: string) {
    return this.suppliersService.findAll(organisationId);
  }

  @Get(':id')
  findOne(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.suppliersService.findOne(organisationId, id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)
  update(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(organisationId, id, updateSupplierDto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)
  remove(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.suppliersService.remove(organisationId, id);
  }
}
