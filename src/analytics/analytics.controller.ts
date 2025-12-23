import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  async getDashboardStats(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Only admin and support can access analytics
    if (!['admin', 'support'].includes(req.user.role)) {
      throw new Error('Unauthorized');
    }

    return this.analyticsService.getDashboardStats(
      req.user.role,
      startDate,
      endDate,
    );
  }
}




