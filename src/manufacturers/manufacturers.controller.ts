import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ManufacturersService } from './manufacturers.service';
import { RejectManufacturerDto } from './dto/reject-manufacturer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('manufacturers')
@UseGuards(JwtAuthGuard)
export class ManufacturersController {
  constructor(private readonly manufacturersService: ManufacturersService) {}

  @Get()
  async findAll(@Request() req) {
    return this.manufacturersService.findAll(req.user.role);
  }

  @Get('me')
  async findMyManufacturer(@Request() req) {
    return this.manufacturersService.findMyManufacturer(req.user.userId);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    return this.manufacturersService.findOne(id, req.user.userId, req.user.role);
  }

  @Post(':id/approve')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    // Only admin and support can approve
    if (!['admin', 'support'].includes(req.user.role)) {
      throw new Error('Unauthorized');
    }
    return this.manufacturersService.approve(id, req.user.userId);
  }

  @Post(':id/reject')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() rejectDto: RejectManufacturerDto,
  ) {
    // Only admin and support can reject
    if (!['admin', 'support'].includes(req.user.role)) {
      throw new Error('Unauthorized');
    }
    return this.manufacturersService.reject(id, rejectDto, req.user.userId);
  }
}




