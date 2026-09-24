import { BranchVisibilityService } from '../branch-visibility/branch-visibility.service';
import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
  Post,
  Body,
} from '@nestjs/common';
import { AnalyticsService, AnalyticsBranchCtx } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly branchVisibility: BranchVisibilityService,
  ) {}

  // Branch scoping (scope/Branch_Scoping_Remediation_Plan_2026-09-24.md):
  // Phase 5 (G9) refused clinic analytics to branch-restricted users because
  // they aggregated the whole organisation. Phase 9: every clinic analytic is
  // computed over the caller's branches (patient scope for clinical / stay /
  // expense data, inventory scope for procurement / stock), then narrowed by
  // the switcher's ?branchId — which can never widen the scope.
  private async branchCtx(req: any, branchId?: string): Promise<AnalyticsBranchCtx> {
    const [patient, inventory] = await Promise.all([
      this.branchVisibility.scopeFor(req.user),
      this.branchVisibility.inventoryScopeFor(req.user),
    ]);
    return { patient, inventory, branchId };
  }

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
    @Query('branchId') branchId?: string,
  ) {
    const ctx = await this.branchCtx(req, branchId);
    const organisationId = req.user.organisationId;
    if (!organisationId) {
      throw new ForbiddenException('No organisation associated with this account');
    }
    return this.analyticsService.getClinicDashboard(organisationId, startDate, endDate, ctx);
  }

  // Phase 24B.1 — Procurement leakage for the caller's own clinic.
  @Get('procurement')
  async getProcurementAnalytics(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') branchId?: string,
  ) {
    const ctx = await this.branchCtx(req, branchId);
    const organisationId = req.user.organisationId;
    if (!organisationId) {
      throw new ForbiddenException('No organisation associated with this account');
    }
    return this.analyticsService.getProcurementAnalytics(
      organisationId,
      startDate,
      endDate,
      ctx,
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
  async getInventoryHealth(@Request() req, @Query('branchId') branchId?: string) {
    const ctx = await this.branchCtx(req, branchId);
    const organisationId = req.user.organisationId;
    if (!organisationId) {
      throw new ForbiddenException('No organisation associated with this account');
    }
    return this.analyticsService.getInventoryHealth(organisationId, ctx);
  }

  // Phase 24B.3 — supplier performance (lead-time + price variance), own clinic.
  @Get('supplier-performance')
  async getSupplierPerformance(@Request() req, @Query('branchId') branchId?: string) {
    const ctx = await this.branchCtx(req, branchId);
    const organisationId = req.user.organisationId;
    if (!organisationId) {
      throw new ForbiddenException('No organisation associated with this account');
    }
    return this.analyticsService.getSupplierPerformance(organisationId, ctx);
  }

  // Phase 24A.3 — unified purchase + expense spend view, own clinic.
  @Get('spend-summary')
  async getSpendSummary(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') branchId?: string,
  ) {
    const ctx = await this.branchCtx(req, branchId);
    const organisationId = req.user.organisationId;
    if (!organisationId) {
      throw new ForbiddenException('No organisation associated with this account');
    }
    return this.analyticsService.getSpendSummary(organisationId, startDate, endDate, ctx);
  }

  // Phase 24B.6 — postnatal occupancy, own clinic.
  @Get('postnatal-occupancy')
  async getPostnatalOccupancy(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') branchId?: string,
  ) {
    const ctx = await this.branchCtx(req, branchId);
    const organisationId = req.user.organisationId;
    if (!organisationId) {
      throw new ForbiddenException('No organisation associated with this account');
    }
    return this.analyticsService.getPostnatalOccupancy(organisationId, startDate, endDate, ctx);
  }

  @Post('events')
  async recordEvents(
    @Request() req,
    @Body('events') events: any[],
  ) {
    const organisationId = req.user.organisationId;
    const userId = req.user.userId;
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

  // Phase 20M — which clinics use which features/modules most.
  @Get('feature-usage/by-org')
  async getFeatureUsageByOrg(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userRole = req.user.role?.toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'SUPPORT';

    if (!isAdmin) {
      throw new ForbiddenException('You do not have permission to view feature usage analytics');
    }

    return this.analyticsService.getFeatureUsageByOrg(startDate, endDate);
  }

  // Phase 20M — which staff use which features/modules most, optionally scoped to one clinic.
  @Get('feature-usage/by-user')
  async getFeatureUsageByUser(
    @Request() req,
    @Query('organisationId') organisationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const userRole = req.user.role?.toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'SUPPORT';

    if (!isAdmin) {
      throw new ForbiddenException('You do not have permission to view feature usage analytics');
    }

    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 20, 200) : undefined;
    return this.analyticsService.getFeatureUsageByUser(organisationId, startDate, endDate, parsedLimit);
  }

  // Which medicines a clinic is searching for / adding to cart — feeds the
  // clinic detail screen's "Marketplace Activity" section.
  @Get('marketplace-activity/by-org')
  async getMarketplaceActivityByOrg(
    @Request() req,
    @Query('organisationId') organisationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userRole = req.user.role?.toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'SUPPORT';

    if (!isAdmin) {
      throw new ForbiddenException('You do not have permission to view marketplace activity analytics');
    }

    return this.analyticsService.getMarketplaceActivityByOrg(organisationId, startDate, endDate);
  }

  // Recent booking lifecycle activity (create/confirm/cancel/check-in/promote/
  // edit/remove), full detail per event — feeds the clinic detail screen's
  // "Booking Activity" feed.
  @Get('booking-activity/by-org')
  async getBookingActivityByOrg(
    @Request() req,
    @Query('organisationId') organisationId?: string,
    @Query('limit') limit?: string,
  ) {
    const userRole = req.user.role?.toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'SUPPORT';

    if (!isAdmin) {
      throw new ForbiddenException('You do not have permission to view booking activity analytics');
    }

    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 30, 100) : undefined;
    return this.analyticsService.getBookingActivityByOrg(organisationId, parsedLimit);
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

  // Tracking Phase 4/5 item 3 -- answers one concrete "of sessions that
  // viewed X, how many subsequently did Y" question at a time, not a
  // per-screen engagement ranking. See
  // AnalyticsService.getScreenToActionConversion for the full design
  // rationale (bounded time window, not a bare sessionId match).
  @Get('screen-to-action')
  async getScreenToActionConversion(
    @Request() req,
    @Query('fromScreen') fromScreen: string,
    @Query('toEventType') toEventType: string,
    @Query('days') days?: string,
    @Query('withinMinutes') withinMinutes?: string,
  ) {
    const userRole = req.user.role?.toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'SUPPORT';

    if (!isAdmin) {
      throw new ForbiddenException('You do not have permission to view screen-to-action analytics');
    }

    if (!fromScreen || !toEventType) {
      throw new BadRequestException('fromScreen and toEventType are both required.');
    }

    const daysInt = days ? parseInt(days, 10) : 30;
    const withinMinutesInt = withinMinutes ? parseInt(withinMinutes, 10) : 30;
    return this.analyticsService.getScreenToActionConversion(fromScreen, toEventType, daysInt, withinMinutesInt);
  }
}
