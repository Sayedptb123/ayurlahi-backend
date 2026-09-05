import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { GetPendingBranchesDto } from './dto/get-pending-branches.dto';
import { GetBranchesForOrgDto } from './dto/get-branches-for-org.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { isTeamManagementTier } from '../common/utils/team-access.util';
import { StaffBranchAssignmentsService } from '../staff-branch-assignments/staff-branch-assignments.service';

function requireTeam(req: any) {
  if (req.user?.organisationType !== 'AYURLAHI_TEAM') {
    throw new ForbiddenException('Only Ayurlahi Team members can perform this action');
  }
}

// Deliberately top-level (/branches/...), not nested under
// organisations/:organisationId/branches — OrganisationGuard on that
// controller requires the caller to belong to the target organisation, which
// an Ayurlahi Team reviewer approving another org's branch never does.
// Mirrors organisations.controller.ts's own approve()/reject() shape exactly.
@Controller('branches')
@UseGuards(JwtAuthGuard)
export class BranchesAdminController {
  constructor(
    private readonly branchesService: BranchesService,
    private readonly staffBranchAssignmentsService: StaffBranchAssignmentsService,
  ) {}

  // All branches (active + inactive, not just pending) for a given org —
  // Team-management tier only. See scope/Super_Admin_Org_Staff_Management_Phase2_Scope.md §2c.
  // Deliberately its own check (isTeamManagementTier), not requireTeam() —
  // this is a new endpoint and shouldn't inherit the role-blind check already
  // flagged as separate cleanup on this controller's existing routes.
  @Get()
  findAllForOrg(@Query() query: GetBranchesForOrgDto, @Request() req) {
    if (!isTeamManagementTier(req.user)) {
      throw new ForbiddenException('Only Ayurlahi Team management can view this');
    }
    const { organisationId, ...rest } = query;
    return this.branchesService.findAll(organisationId, rest);
  }

  @Get('pending')
  findAllPending(@Query() query: GetPendingBranchesDto, @Request() req) {
    requireTeam(req);
    return this.branchesService.findAllPending(query);
  }

  // Org staff with no active branch assignment anywhere — Team-management
  // tier only. Surfaces the gap between "has a staff record" and "has been
  // assigned to a branch" so the per-branch drill-down doesn't look like it
  // lost people who simply were never assigned.
  @Get('unassigned-staff')
  getUnassignedStaff(@Query('organisationId') organisationId: string, @Request() req) {
    if (!isTeamManagementTier(req.user)) {
      throw new ForbiddenException('Only Ayurlahi Team management can view this');
    }
    if (!organisationId) {
      throw new BadRequestException('organisationId is required');
    }
    return this.staffBranchAssignmentsService.getUnassignedStaff(organisationId);
  }

  // Per-staff branch summary for the Staff & Access "Branches" column — Team-
  // management tier only. Read-only derivation of the existing
  // staff_branch_assignments data (created/edited only via
  // StaffScreen → staff member → Branches); this does not add a second way
  // to assign staff to branches.
  @Get('assignments')
  getAssignmentsSummary(@Query('organisationId') organisationId: string, @Request() req) {
    if (!isTeamManagementTier(req.user)) {
      throw new ForbiddenException('Only Ayurlahi Team management can view this');
    }
    if (!organisationId) {
      throw new BadRequestException('organisationId is required');
    }
    return this.staffBranchAssignmentsService.getStaffBranchSummary(organisationId);
  }

  // Staff assigned specifically to this branch — Team-management tier only.
  // Deliberately its own top-level route rather than the nested
  // staff-branch-assignments controller (same OrganisationGuard problem noted
  // above): a Team reviewer drilling into one branch of another org's
  // multi-branch clinic never belongs to that org.
  @Get(':id/staff')
  getBranchStaff(
    @Param('id') branchId: string,
    @Query('organisationId') organisationId: string,
    @Request() req,
  ) {
    if (!isTeamManagementTier(req.user)) {
      throw new ForbiddenException('Only Ayurlahi Team management can view this');
    }
    if (!organisationId) {
      throw new BadRequestException('organisationId is required');
    }
    return this.staffBranchAssignmentsService.getBranchStaff(branchId, organisationId);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Request() req) {
    requireTeam(req);
    return this.branchesService.approve(id, req.user?.userId);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body('rejectionReason') rejectionReason: string,
    @Request() req,
  ) {
    requireTeam(req);
    return this.branchesService.reject(id, rejectionReason, req.user?.userId);
  }
}
