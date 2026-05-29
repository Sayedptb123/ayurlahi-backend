import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) { }

  @Get('dashboard')
  async getDashboardStats(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userRole = req.user.role?.toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    const isSupport = userRole === 'SUPPORT';

    if (!isAdmin && !isSupport) {
      throw new ForbiddenException(
        'You do not have permission to view analytics',
      );
    }

    const legacyRole = isAdmin ? 'admin' : 'support';
    return this.analyticsService.getDashboardStats(legacyRole, startDate, endDate);
  }

  @Get('clinic')
  async getClinicDashboard(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const organisationId = req.user.organisationId;
    if (!organisationId) {
      throw new ForbiddenException('No organisation associated with this account');
    }
    return this.analyticsService.getClinicDashboard(organisationId, startDate, endDate);
  }
}
