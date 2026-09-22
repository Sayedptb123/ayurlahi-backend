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
} from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { GetPrescriptionsDto } from './dto/get-prescriptions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthAuditContext } from '../auth/auth.service';

@Controller('prescriptions')
@UseGuards(JwtAuthGuard)
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  private auditContext(req: any): AuthAuditContext {
    return {
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    };
  }

  @Post()
  create(@Request() req, @Body() createDto: CreatePrescriptionDto) {
    return this.prescriptionsService.create(
      req.user.userId,
      req.user.role,
      req.user.organisationId,
      req.user.organisationType,
      createDto,
      this.auditContext(req),
    );
  }

  @Get()
  findAll(@Request() req, @Query() query: GetPrescriptionsDto) {
    return this.prescriptionsService.findAll(
      req.user.userId,
      req.user.role,
      req.user.organisationId,
      req.user.organisationType,
      query,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.prescriptionsService.findOne(
      id,
      req.user.userId,
      req.user.role,
      req.user.organisationId,
      req.user.organisationType,
      this.auditContext(req),
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() updateDto: UpdatePrescriptionDto,
  ) {
    return this.prescriptionsService.update(
      id,
      req.user.userId,
      req.user.role,
      req.user.organisationId,
      req.user.organisationType,
      updateDto,
      this.auditContext(req),
    );
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.prescriptionsService.remove(
      id,
      req.user.userId,
      req.user.role,
      req.user.organisationId,
      req.user.organisationType,
      this.auditContext(req),
    );
  }
}
