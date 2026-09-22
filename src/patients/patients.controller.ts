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
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { GetPatientsDto } from './dto/get-patients.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthAuditContext } from '../auth/auth.service';

@Controller('patients')
@UseGuards(JwtAuthGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  // Same helper as AuthController's -- ip/user-agent for audit events,
  // explicit per-request extraction rather than AsyncLocalStorage. See
  // scope/Audit_Trail_Phase3_Patients_Implementation_Plan.md.
  private auditContext(req: any): AuthAuditContext {
    return {
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    };
  }

  @Post()
  create(@Request() req, @Body() createDto: CreatePatientDto) {
    return this.patientsService.create(
      req.user.userId,
      req.user.role,
      req.user.organisationId,
      req.user.organisationType,
      createDto,
      this.auditContext(req),
    );
  }

  @Get()
  findAll(@Request() req, @Query() query: GetPatientsDto) {
    return this.patientsService.findAll(
      req.user.userId,
      req.user.role,
      req.user.organisationId,
      req.user.organisationType,
      query,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.patientsService.findOne(
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
    @Body() updateDto: UpdatePatientDto,
  ) {
    return this.patientsService.update(
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
    return this.patientsService.remove(
      id,
      req.user.userId,
      req.user.role,
      req.user.organisationId,
      req.user.organisationType,
      this.auditContext(req),
    );
  }
}
