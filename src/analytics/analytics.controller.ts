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
    try {
      // Normalize role to handle both organization roles (SUPER_ADMIN, SUPPORT) and legacy roles (admin, support)
      const userRole = req.user.role?.toUpperCase();
      const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
      const isSupport = userRole === 'SUPPORT';

      // Only admin/super_admin and support can access analytics
      if (!isAdmin && !isSupport) {
        throw new ForbiddenException(
          'You do not have permission to view analytics',
        );
      }

      // Map organization role to legacy role for service
      const legacyRole = isAdmin ? 'admin' : 'support';

      return await this.analyticsService.getDashboardStats(
        legacyRole,
        startDate,
        endDate,
      );
    } catch (error) {
      console.error('[Analytics Controller] Error in getDashboardStats:', {
        error: error.message,
        stack: error.stack,
        userRole: req.user?.role,
        userId: req.user?.userId,
      });
      throw error;
    }
  }
}
