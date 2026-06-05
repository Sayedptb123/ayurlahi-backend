import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OrganisationGuard } from '../../auth/guards/organisation.guard';
import { CrmRolesGuard } from '../guards/crm-roles.guard';
import { CrmRoles } from '../decorators/crm-roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { CrmLeadsService } from '../services/crm-leads.service';
import { CrmAuditService } from '../services/crm-audit.service';
import { CreateLeadDto } from '../dto/create-lead.dto';
import { UpdateLeadDto } from '../dto/update-lead.dto';
import { QueryLeadsDto } from '../dto/query-leads.dto';
import { AssignLeadDto, ChangeStageDto } from '../dto/lead-actions.dto';
import { CrmActor } from '../crm-access.util';

/**
 * Sales CRM leads. Mounted under the org so OrganisationGuard pins every
 * request to the caller's own organisation; CrmRolesGuard restricts the module
 * to the AYURLAHI_TEAM and enforces per-role action permissions. Row-level
 * isolation (a telecaller only sees their own leads) lives in the service.
 */
@Controller('organisations/:organisationId/crm/leads')
@UseGuards(JwtAuthGuard, OrganisationGuard, CrmRolesGuard)
export class CrmLeadsController {
  constructor(
    private readonly leadsService: CrmLeadsService,
    private readonly audit: CrmAuditService,
  ) {}

  private actor(req: any): CrmActor {
    return {
      userId: req.user.userId,
      role: req.user.role,
      organisationType: req.user.organisationType,
    };
  }

  @Get()
  findAll(
    @Param('organisationId') organisationId: string,
    @Query() query: QueryLeadsDto,
    @Request() req: any,
  ) {
    return this.leadsService.findAll(organisationId, this.actor(req), query);
  }

  /** Distinct states + districts (with counts) for the filter UI. */
  @Get('facets')
  facets(
    @Param('organisationId') organisationId: string,
    @Query('state') state: string | undefined,
    @Request() req: any,
  ) {
    return this.leadsService.facets(organisationId, this.actor(req), state);
  }

  @Get(':id')
  findOne(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.leadsService.findOne(organisationId, id, this.actor(req));
  }

  @Post()
  create(
    @Param('organisationId') organisationId: string,
    @Body() dto: CreateLeadDto,
    @Request() req: any,
  ) {
    return this.leadsService.create(organisationId, dto, this.actor(req));
  }

  @Patch(':id')
  update(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @Request() req: any,
  ) {
    return this.leadsService.update(organisationId, id, dto, this.actor(req));
  }

  @Post(':id/assign')
  @CrmRoles(UserRole.SALES_MANAGER, UserRole.TEAM_LEAD)
  assign(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() dto: AssignLeadDto,
    @Request() req: any,
  ) {
    return this.leadsService.assign(organisationId, id, dto, this.actor(req));
  }

  @Post(':id/stage')
  changeStage(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() dto: ChangeStageDto,
    @Request() req: any,
  ) {
    return this.leadsService.changeStage(
      organisationId,
      id,
      dto.stage,
      this.actor(req),
      dto.lostReason,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @CrmRoles(UserRole.SALES_MANAGER)
  remove(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.leadsService.softDelete(organisationId, id, this.actor(req));
  }

  /** Immutable audit trail for a lead — Owner/Admin/Manager only (B7). */
  @Get(':id/audit')
  @CrmRoles(UserRole.SALES_MANAGER)
  audits(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.audit.findForEntity(organisationId, 'lead', id);
  }
}
