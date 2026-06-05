import {
  Controller,
  Get,
  Put,
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
import { CrmStaffService } from '../services/crm-staff.service';
import { SetStaffScopeDto } from '../dto/staff-scope.dto';

/**
 * CRM staff management — list team members and set each one's data scope
 * (territory). Manager / Owner / Admin only.
 */
@Controller('organisations/:organisationId/crm/staff')
@UseGuards(JwtAuthGuard, OrganisationGuard, CrmRolesGuard)
@CrmRoles(UserRole.SALES_MANAGER)
export class CrmStaffController {
  constructor(private readonly staff: CrmStaffService) {}

  @Get()
  list(@Param('organisationId') organisationId: string) {
    return this.staff.listStaff(organisationId);
  }

  @Get(':userId/scope')
  getScope(
    @Param('organisationId') organisationId: string,
    @Param('userId') userId: string,
  ) {
    return this.staff.getScope(organisationId, userId);
  }

  @Put(':userId/scope')
  setScope(
    @Param('organisationId') organisationId: string,
    @Param('userId') userId: string,
    @Body() dto: SetStaffScopeDto,
    @Request() req: any,
  ) {
    return this.staff.setScope(organisationId, userId, dto, req.user.userId);
  }
}
