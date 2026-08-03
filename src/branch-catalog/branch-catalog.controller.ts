import { Controller, Get, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { BranchCatalogService } from './branch-catalog.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganisationGuard } from '../auth/guards/organisation.guard';

// ADR-004 D15 — leadership-only, same exemption pattern as D9's branch
// visibility scoping (OWNER/ADMIN/MANAGER manage catalog setup, front-line
// staff don't).
const LEADERSHIP_ROLES = new Set(['OWNER', 'ADMIN', 'MANAGER']);

@Controller('organisations/:organisationId/branch-catalog')
@UseGuards(JwtAuthGuard, OrganisationGuard)
export class BranchCatalogController {
  constructor(private readonly branchCatalogService: BranchCatalogService) {}

  @Get('needs-assignment')
  getNeedsAssignmentSummary(@Param('organisationId') organisationId: string, @Request() req) {
    if (!LEADERSHIP_ROLES.has(req.user?.role)) {
      throw new ForbiddenException('Only organisation leadership can view branch-assignment status');
    }
    return this.branchCatalogService.getNeedsAssignmentSummary(organisationId);
  }
}
