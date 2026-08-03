import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
  constructor(private readonly branchesService: BranchesService) {}

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
