import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OrganisationGuard } from '../../auth/guards/organisation.guard';
import { CrmRolesGuard } from '../guards/crm-roles.guard';
import { CrmRequirementsService } from '../services/crm-requirements.service';
import { CreateRequirementDto, UpdateRequirementDto } from '../dto/requirement.dto';
import { CrmActor } from '../crm-access.util';

/** Structured requirement / feedback capture for a lead (B3). */
@Controller('organisations/:organisationId/crm/leads/:leadId/requirements')
@UseGuards(JwtAuthGuard, OrganisationGuard, CrmRolesGuard)
export class CrmRequirementsController {
  constructor(private readonly service: CrmRequirementsService) {}

  private actor(req: any): CrmActor {
    return {
      userId: req.user.userId,
      role: req.user.role,
      organisationType: req.user.organisationType,
    };
  }

  @Get()
  list(
    @Param('organisationId') organisationId: string,
    @Param('leadId') leadId: string,
    @Request() req: any,
  ) {
    return this.service.listForLead(organisationId, leadId, this.actor(req));
  }

  @Post()
  create(
    @Param('organisationId') organisationId: string,
    @Param('leadId') leadId: string,
    @Body() dto: CreateRequirementDto,
    @Request() req: any,
  ) {
    return this.service.create(organisationId, leadId, dto, this.actor(req));
  }

  @Patch(':id')
  update(
    @Param('organisationId') organisationId: string,
    @Param('leadId') leadId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRequirementDto,
    @Request() req: any,
  ) {
    return this.service.update(organisationId, leadId, id, dto, this.actor(req));
  }
}
