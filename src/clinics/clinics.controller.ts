import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { RejectClinicDto } from './dto/approve-clinic.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleUtils } from '../common/utils/role.utils';

@Controller('clinics')
@UseGuards(JwtAuthGuard)
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) { }

  @Get()
  async findAll(@Request() req) {
    return this.clinicsService.findAll(req.user.role);
  }

  @Get('me')
  async findMyClinic(@Request() req) {
    const clinic = await this.clinicsService.findMyClinic(req.user.userId);
    // Return null as a proper response (200 with null body) instead of 404
    // Frontend can handle this gracefully
    return clinic;
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.clinicsService.findOne(id, req.user.userId, req.user.role);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() updateDto: UpdateClinicDto,
  ) {
    return this.clinicsService.update(
      id,
      req.user.userId,
      req.user.role,
      updateDto,
    );
  }

  @Post(':id/approve')
  async approve(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    // Only admin and support can approve
    if (!RoleUtils.isAdminOrSupport(req.user.role)) {
      throw new Error('Unauthorized');
    }
    return this.clinicsService.approve(id, req.user.userId);
  }

  @Post(':id/reject')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() rejectDto: RejectClinicDto,
  ) {
    // Only admin and support can reject
    if (!RoleUtils.isAdminOrSupport(req.user.role)) {
      throw new Error('Unauthorized');
    }
    return this.clinicsService.reject(id, rejectDto, req.user.userId);
  }
}
