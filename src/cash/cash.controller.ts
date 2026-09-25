import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CashGoLiveService, CashActor } from './cash-go-live.service';
import { GoLiveDto } from './dto/go-live.dto';
import { CashBooksService } from './cash-books.service';

// Authorisation lives in CashGoLiveService, from the JWT: clinic organisations
// only, and OWNER/ADMIN for set-up and go-live. RolesGuard/@Roles is not used
// here because it maps a clinic ADMIN to 'admin', which matches no clinic role
// and would lock clinic admins out. Everything is scoped to the caller's
// organisation from the token, never from the request.
const actor = (req: any): CashActor => ({
  userId: req.user.userId,
  organisationId: req.user.organisationId,
  organisationType: req.user.organisationType,
  role: req.user.role,
});

@Controller('cash')
@UseGuards(JwtAuthGuard)
export class CashController {
  constructor(
    private readonly goLive: CashGoLiveService,
    private readonly books: CashBooksService,
  ) {}

  // Whether this organisation's cash tracking is live (drives the picker).
  @Get('status')
  status(@Request() req) {
    return this.goLive.status(actor(req));
  }

  // Ledgers a payment can be received into, filtered by payment method.
  @Get('receiving-ledgers')
  receivingLedgers(
    @Request() req,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.goLive.receivingLedgers(actor(req), paymentMethod, branchId);
  }

  @Post('go-live/seed')
  seed(@Request() req) {
    return this.goLive.seed(actor(req));
  }

  // Read-only preview of the opening journal.
  @Post('go-live/preview')
  preview(@Request() req, @Body() dto: GoLiveDto) {
    return this.goLive.preview(actor(req), dto.balances);
  }

  // Posts the opening journal and switches cash tracking on, atomically.
  @Post('go-live')
  confirm(@Request() req, @Body() dto: GoLiveDto) {
    return this.goLive.confirm(actor(req), dto.balances);
  }

  // ── Books (read-only; OWNER/ADMIN/MANAGER) ──────────────────────────────
  // branchId is the branch switcher: it narrows, never widens.

  @Get('today')
  today(@Request() req, @Query('date') date?: string, @Query('branchId') branchId?: string) {
    return this.books.today(actor(req), date, branchId);
  }

  @Get('day-book')
  dayBook(
    @Request() req,
    @Query('date') date?: string,
    @Query('branchId') branchId?: string,
    @Query('type') type?: string,
  ) {
    return this.books.dayBook(actor(req), date, branchId, type);
  }

  @Get('ledgers/:id/book')
  ledgerBook(@Request() req, @Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.books.ledgerBook(actor(req), id, from, to);
  }

  @Get('vouchers/:id')
  voucher(@Request() req, @Param('id') id: string) {
    return this.books.voucher(actor(req), id);
  }
}
