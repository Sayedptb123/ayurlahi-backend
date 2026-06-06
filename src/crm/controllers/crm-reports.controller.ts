import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OrganisationGuard } from '../../auth/guards/organisation.guard';
import { CrmRolesGuard } from '../guards/crm-roles.guard';
import { CrmRoles } from '../decorators/crm-roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { CrmReportsService } from '../services/crm-reports.service';

@Controller('organisations/:organisationId/crm/reports')
@UseGuards(JwtAuthGuard, OrganisationGuard, CrmRolesGuard)
export class CrmReportsController {
  constructor(private readonly reportsService: CrmReportsService) {}

  @Get('funnel')
  getFunnelReport(@Param('organisationId') organisationId: string) {
    return this.reportsService.getFunnelReport(organisationId);
  }

  @Get('staff-performance')
  getStaffPerformance(@Param('organisationId') organisationId: string) {
    return this.reportsService.getStaffPerformance(organisationId);
  }

  @Get('export')
  @CrmRoles(UserRole.SALES_MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN)
  exportLeads(@Param('organisationId') organisationId: string) {
    return this.reportsService.exportLeads(organisationId);
  }
}
