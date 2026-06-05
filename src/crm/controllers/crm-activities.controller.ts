import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OrganisationGuard } from '../../auth/guards/organisation.guard';
import { CrmRolesGuard } from '../guards/crm-roles.guard';
import { CrmActivitiesService } from '../services/crm-activities.service';
import { CreateActivityDto } from '../dto/create-activity.dto';
import { CrmActor } from '../crm-access.util';

/** Interaction timeline for a lead (B4). Visible to whoever holds the lead. */
@Controller('organisations/:organisationId/crm/leads/:leadId/activities')
@UseGuards(JwtAuthGuard, OrganisationGuard, CrmRolesGuard)
export class CrmActivitiesController {
  constructor(private readonly service: CrmActivitiesService) {}

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
    @Body() dto: CreateActivityDto,
    @Request() req: any,
  ) {
    return this.service.create(organisationId, leadId, dto, this.actor(req));
  }
}
