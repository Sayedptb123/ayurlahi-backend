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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { GetStaffDto } from './dto/get-staff.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('staff')
@UseGuards(JwtAuthGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  async findAll(@Request() req, @Query() query: GetStaffDto) {
    return this.staffService.findAll(req.user.userId, req.user.role, query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.staffService.findOne(id, req.user.userId, req.user.role);
  }

  @Post()
  async create(@Request() req, @Body() createDto: CreateStaffDto) {
    return this.staffService.create(req.user.userId, req.user.role, createDto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() updateDto: UpdateStaffDto,
  ) {
    return this.staffService.update(
      id,
      req.user.userId,
      req.user.role,
      updateDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.staffService.remove(id, req.user.userId, req.user.role);
  }

  @Patch(':id/status')
  async toggleStatus(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.staffService.toggleStatus(id, req.user.userId, req.user.role);
  }
}
