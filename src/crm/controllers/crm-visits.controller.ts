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
import { CrmRoles } from '../decorators/crm-roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { CrmVisitsService } from '../services/crm-visits.service';
import { ScheduleVisitDto, CheckInDto, CheckOutDto } from '../dto/visit.dto';
import { CrmActor } from '../crm-access.util';

/** Geo-tagged site visits (B5). */
@Controller('organisations/:organisationId/crm')
@UseGuards(JwtAuthGuard, OrganisationGuard, CrmRolesGuard)
export class CrmVisitsController {
  constructor(private readonly service: CrmVisitsService) {}

  private actor(req: any): CrmActor {
    return {
      userId: req.user.userId,
      role: req.user.role,
      organisationType: req.user.organisationType,
    };
  }

  @Get('visits')
  listMine(@Param('organisationId') organisationId: string, @Request() req: any) {
    return this.service.listMine(organisationId, this.actor(req));
  }

  @Get('leads/:leadId/visits')
  listForLead(
    @Param('organisationId') organisationId: string,
    @Param('leadId') leadId: string,
    @Request() req: any,
  ) {
    return this.service.listForLead(organisationId, leadId, this.actor(req));
  }

  @Post('leads/:leadId/visits')
  @CrmRoles(UserRole.FIELD_STAFF, UserRole.TEAM_LEAD, UserRole.SALES_MANAGER)
  schedule(
    @Param('organisationId') organisationId: string,
    @Param('leadId') leadId: string,
    @Body() dto: ScheduleVisitDto,
    @Request() req: any,
  ) {
    return this.service.schedule(organisationId, leadId, dto, this.actor(req));
  }

  @Post('visits/:id/check-in')
  @CrmRoles(UserRole.FIELD_STAFF, UserRole.TEAM_LEAD, UserRole.SALES_MANAGER)
  checkIn(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() dto: CheckInDto,
    @Request() req: any,
  ) {
    return this.service.checkIn(organisationId, id, dto, this.actor(req));
  }

  @Post('visits/:id/check-out')
  @CrmRoles(UserRole.FIELD_STAFF, UserRole.TEAM_LEAD, UserRole.SALES_MANAGER)
  checkOut(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() dto: CheckOutDto,
    @Request() req: any,
  ) {
    return this.service.checkOut(organisationId, id, dto, this.actor(req));
  }
}
