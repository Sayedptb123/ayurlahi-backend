import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ManufacturersService } from './manufacturers.service';
import { RejectManufacturerDto } from './dto/reject-manufacturer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleUtils } from '../common/utils/role.utils';

@Controller('manufacturers')
@UseGuards(JwtAuthGuard)
export class ManufacturersController {
  constructor(private readonly manufacturersService: ManufacturersService) { }

  @Get()
  async findAll(@Request() req, @Query() query: { status?: string; page?: string; limit?: string }) {
    return this.manufacturersService.findAll(req.user.role, {
      status: query.status,
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
    });
  }

  @Get('me')
  async findMyManufacturer(@Request() req) {
    return this.manufacturersService.findMyManufacturer(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.manufacturersService.findOne(
      id,
      req.user.userId,
      req.user.role,
    );
  }

  @Post(':id/approve')
  async approve(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    // Only admin and support can approve
    if (!RoleUtils.isAdminOrSupport(req.user.role)) {
      throw new Error('Unauthorized');
    }
    return this.manufacturersService.approve(id, req.user.userId);
  }

  @Post(':id/toggle-active')
  async toggleActive(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    if (!RoleUtils.isAdminOrSupport(req.user.role)) {
      throw new Error('Unauthorized');
    }
    return this.manufacturersService.toggleActive(id);
  }

  @Post(':id/reject')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() rejectDto: RejectManufacturerDto,
  ) {
    // Only admin and support can reject
    if (!RoleUtils.isAdminOrSupport(req.user.role)) {
      throw new Error('Unauthorized');
    }
    return this.manufacturersService.reject(id, rejectDto, req.user.userId);
  }
}
