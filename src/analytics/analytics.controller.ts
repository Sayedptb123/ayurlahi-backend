import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  Post,
  Body,
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

  // Phase 24B.1 — Procurement leakage for the caller's own clinic.
  @Get('procurement')
  async getProcurementAnalytics(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const organisationId = req.user.organisationId;
    if (!organisationId) {
      throw new ForbiddenException('No organisation associated with this account');
    }
    return this.analyticsService.getProcurementAnalytics(
      organisationId,
      startDate,
      endDate,
    );
  }

  // Phase 24B.1 — Base-wide procurement leakage (AYURLAHI_TEAM only).
  @Get('procurement/base')
  async getProcurementAnalyticsBase(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userRole = req.user.role?.toUpperCase();
    const isAdmin =
      userRole === 'ADMIN' ||
      userRole === 'SUPER_ADMIN' ||
      userRole === 'SUPPORT';
    if (!isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to view base-wide procurement analytics',
      );
    }
    return this.analyticsService.getProcurementAnalyticsBase(startDate, endDate);
  }

  // Phase 24B.4 — inventory health for the caller's own clinic.
  @Get('inventory-health')
  async getInventoryHealth(@Request() req) {
    const organisationId = req.user.organisationId;
    if (!organisationId) {
      throw new ForbiddenException('No organisation associated with this account');
    }
    return this.analyticsService.getInventoryHealth(organisationId);
  }

  // Phase 24B.3 — supplier performance (lead-time + price variance), own clinic.
  @Get('supplier-performance')
  async getSupplierPerformance(@Request() req) {
    const organisationId = req.user.organisationId;
    if (!organisationId) {
      throw new ForbiddenException('No organisation associated with this account');
    }
    return this.analyticsService.getSupplierPerformance(organisationId);
  }

  // Phase 24A.3 — unified purchase + expense spend view, own clinic.
  @Get('spend-summary')
  async getSpendSummary(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const organisationId = req.user.organisationId;
    if (!organisationId) {
      throw new ForbiddenException('No organisation associated with this account');
    }
    return this.analyticsService.getSpendSummary(organisationId, startDate, endDate);
  }

  // Phase 24B.6 — postnatal occupancy, own clinic.
  @Get('postnatal-occupancy')
  async getPostnatalOccupancy(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const organisationId = req.user.organisationId;
    if (!organisationId) {
      throw new ForbiddenException('No organisation associated with this account');
    }
    return this.analyticsService.getPostnatalOccupancy(organisationId, startDate, endDate);
  }

  @Post('events')
  async recordEvents(
    @Request() req,
    @Body('events') events: any[],
  ) {
    const organisationId = req.user.organisationId;
    const userId = req.user.id;
    return this.analyticsService.recordEvents(events, organisationId, userId);
  }

  @Get('telemetry')
  async getTelemetryStats(@Request() req) {
    const userRole = req.user.role?.toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'SUPPORT';
    
    if (!isAdmin) {
      throw new ForbiddenException('You do not have permission to view telemetry stats');
    }

    return this.analyticsService.getTelemetryStats();
  }

  @Get('marketplace')
  async getMarketplaceAnalytics(@Request() req, @Query('days') days?: string) {
    const userRole = req.user.role?.toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'SUPPORT';
    
    if (!isAdmin) {
      throw new ForbiddenException('You do not have permission to view marketplace analytics');
    }

    const daysInt = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getMarketplaceAnalytics(daysInt);
  }

  @Get('funnels')
  async getFunnelAnalytics(@Request() req, @Query('days') days?: string) {
    const userRole = req.user.role?.toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'SUPPORT';
    
    if (!isAdmin) {
      throw new ForbiddenException('You do not have permission to view funnel analytics');
    }

    const daysInt = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getFunnelAnalytics(daysInt);
  }
}
