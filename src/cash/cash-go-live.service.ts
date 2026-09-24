import { BranchVisibilityService } from '../branch-visibility/branch-visibility.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { organisationBusinessDate } from '../common/business-date';
import { CashLedgersService } from './cash-ledgers.service';
import { VoucherPostingService } from './voucher-posting.service';

// Go-live (Cash MVP plan §7, schema review §7): seed ledgers → enter counted
// cash and bank/UPI balances → work out open booking advances → preview the
// opening journal → confirm. Confirming posts the opening journal and sets
// cash_module_live_from in ONE transaction, so neither can exist without the
// other. Go-live is always today's business date: earlier payments were
// recorded without vouchers and are already in the counted cash.

export interface CashActor {
  userId: string;
  organisationId: string;
  organisationType?: string;
  role?: string;
}

export interface OpeningBalanceInput {
  accountId: string;
  amount: number;
}

export interface OpeningPreviewLine {
  accountId: string;
  name: string;
  kind: string;
  debit: string;
  credit: string;
}

export interface OpeningPreview {
  goLiveDate: string;
  alreadyLive: string | null;
  lines: OpeningPreviewLine[];
  totals: { balances: string; patientAdvances: string; openingBalance: string };
  advances: { bookings: number; amount: string; noShowNotCounted: { bookings: number; amount: string } };
}

const GO_LIVE_ROLES = ['OWNER', 'ADMIN'];
const NOT_ENABLED = 'Cash tracking has not been enabled for this clinic yet. Contact Ayurlahi support to enable it.';
const BALANCE_KINDS = ['cash', 'bank', 'upi', 'held_by_partner'];
const rupees = (p: number) => (p / 100).toFixed(2);

@Injectable()
export class CashGoLiveService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ledgers: CashLedgersService,
    private readonly posting: VoucherPostingService,
    private readonly branchVisibility: BranchVisibilityService,
  ) {}

  async status(actor: CashActor) {
    this.assertClinic(actor);
    const m = this.dataSource.manager;
    const [row] = await m.query(
      `SELECT to_char(s.cash_module_live_from, 'YYYY-MM-DD') AS live_from,
              s.cash_module_enabled AS enabled,
              (SELECT count(*)::int FROM accounts a WHERE a.organisation_id = s.organisation_id) AS ledgers
         FROM organisation_settings s WHERE s.organisation_id = $1`,
      [actor.organisationId],
    );
    return { liveFrom: row?.live_from ?? null, enabled: !!row?.enabled, ledgersSeeded: (row?.ledgers ?? 0) > 0 };
  }

  // Active ledgers a patient payment can be received into, for the picker.
  // The backend still validates the choice when the payment is saved.
  // Branch scoping G7: a branch-restricted user only ever sees their own
  // branches' ledgers (plus organisation-wide ones: bank, UPI, partners), and
  // when the form says which record is being paid (branchId), only that
  // branch's drawers — the server re-checks the choice on posting anyway.
  async receivingLedgers(actor: CashActor, paymentMethod?: string, branchId?: string) {
    this.assertClinic(actor);
    const scope = await this.branchVisibility.scopeFor(actor);
    const rows: Array<{ id: string; name: string; kind: string; branch_id: string | null }> =
      await this.dataSource.manager.query(
        `SELECT id, name, kind, branch_id FROM accounts
          WHERE organisation_id = $1 AND is_active AND kind = ANY($2::text[])
          ORDER BY kind, name`,
        [actor.organisationId, BALANCE_KINDS],
      );
    const allowed = paymentMethod ? CashLedgersService.receivingKinds(paymentMethod) : BALANCE_KINDS;
    return rows
      .filter((r) => allowed.includes(r.kind))
      .filter((r) => !r.branch_id || scope.kind === 'all' || scope.ids.includes(r.branch_id))
      .filter((r) => !r.branch_id || !branchId || r.branch_id === branchId)
      .map((r) => ({ id: r.id, name: r.name, kind: r.kind, branchId: r.branch_id }));
  }

  async seed(actor: CashActor): Promise<{ created: number }> {
    this.assertGoLiveRole(actor);
    await this.assertEnabled(this.dataSource.manager, actor.organisationId);
    const created = await this.dataSource.transaction((m) =>
      this.ledgers.seedPaymentLedgers(m, actor.organisationId),
    );
    return { created };
  }

  // Read-only: computes the opening journal without writing anything.
  async preview(actor: CashActor, balances: OpeningBalanceInput[]): Promise<OpeningPreview> {
    this.assertGoLiveRole(actor);
    await this.assertEnabled(this.dataSource.manager, actor.organisationId);
    return this.buildOpening(this.dataSource.manager, actor.organisationId, balances);
  }

  async confirm(actor: CashActor, balances: OpeningBalanceInput[]) {
    this.assertGoLiveRole(actor);
    return this.dataSource.transaction(async (m) => {
      // Lock the settings row so two confirmations can't both go through.
      const [settings] = await m.query(
        `SELECT to_char(cash_module_live_from, 'YYYY-MM-DD') AS live_from, cash_module_enabled AS enabled
           FROM organisation_settings WHERE organisation_id = $1 FOR UPDATE`,
        [actor.organisationId],
      );
      if (!settings) throw new BadRequestException('Organisation settings not found');
      if (!settings.enabled) throw new ForbiddenException(NOT_ENABLED);
      if (settings.live_from) {
        throw new ConflictException(`Cash tracking is already live (since ${settings.live_from})`);
      }

      const opening = await this.buildOpening(m, actor.organisationId, balances);
      await m.query(
        `UPDATE organisation_settings SET cash_module_live_from = $2, updated_at = now() WHERE organisation_id = $1`,
        [actor.organisationId, opening.goLiveDate],
      );
      const voucher = opening.lines.length
        ? await this.posting.post(m, {
            organisationId: actor.organisationId,
            voucherType: 'journal',
            voucherDate: opening.goLiveDate,
            narration: `Opening balances on ${opening.goLiveDate} (cash tracking go-live)`,
            sourceType: 'opening',
            sourceId: actor.organisationId, // one opening per organisation
            lines: opening.lines.map((l) => ({
              accountId: l.accountId,
              debit: Number(l.debit),
              credit: Number(l.credit),
            })),
            createdBy: actor.userId,
            actorRole: actor.role ?? null,
            requireLive: true,
          })
        : null;
      return { liveFrom: opening.goLiveDate, openingVoucher: voucher, preview: opening };
    });
  }

  private async buildOpening(
    m: EntityManager,
    organisationId: string,
    balances: OpeningBalanceInput[],
  ): Promise<OpeningPreview> {
    const goLiveDate = await organisationBusinessDate(m, organisationId);
    const [s] = await m.query(
      `SELECT to_char(cash_module_live_from, 'YYYY-MM-DD') AS live_from FROM organisation_settings WHERE organisation_id = $1`,
      [organisationId],
    );

    const keyed: Array<{ id: string; system_key: string }> = await m.query(
      `SELECT id, system_key FROM accounts WHERE organisation_id = $1 AND system_key IN ('patient_advances','opening_balance') AND is_active`,
      [organisationId],
    );
    const advancesAcc = keyed.find((a) => a.system_key === 'patient_advances');
    const openingAcc = keyed.find((a) => a.system_key === 'opening_balance');
    if (!advancesAcc || !openingAcc) {
      throw new BadRequestException('Set up the cash ledgers first');
    }

    // Counted cash and statement balances, one entry per ledger.
    if (!Array.isArray(balances)) throw new BadRequestException('balances must be a list');
    const seen = new Set<string>();
    const entries: Array<{ accountId: string; paise: number }> = [];
    for (const b of balances) {
      if (!b?.accountId || seen.has(b.accountId)) {
        throw new BadRequestException('Each ledger can appear once in the opening balances');
      }
      seen.add(b.accountId);
      const n = Number(b.amount);
      const paise = Math.round(n * 100);
      if (!Number.isFinite(n) || n < 0 || Math.abs(n * 100 - paise) > 1e-6) {
        throw new BadRequestException('Opening amounts must be zero or more, with at most 2 decimals');
      }
      if (paise > 0) entries.push({ accountId: b.accountId, paise });
    }
    const accounts: Array<{ id: string; name: string; kind: string }> = entries.length
      ? await m.query(
          `SELECT id, name, kind FROM accounts WHERE organisation_id = $1 AND is_active AND id = ANY($2::uuid[])`,
          [organisationId, entries.map((e) => e.accountId)],
        )
      : [];
    for (const e of entries) {
      const a = accounts.find((x) => x.id === e.accountId);
      if (!a) throw new BadRequestException('Opening balances can only be entered for this organisation\'s active ledgers');
      if (!BALANCE_KINDS.includes(a.kind)) {
        throw new BadRequestException(`"${a.name}" is not a cash, bank, UPI or partner-held ledger`);
      }
    }

    // Money already taken as booking advances is owed to those patients
    // (review §7, C10): open bookings, and cancelled ones not yet refunded.
    const [adv] = await m.query(
      `SELECT count(*) FILTER (WHERE counted)::int AS bookings,
              COALESCE(round(sum(advance_paid * 100) FILTER (WHERE counted)), 0)::bigint AS paise,
              count(*) FILTER (WHERE status = 'NO_SHOW')::int AS no_show,
              COALESCE(round(sum(advance_paid * 100) FILTER (WHERE status = 'NO_SHOW')), 0)::bigint AS no_show_paise
         FROM (SELECT status, advance_paid,
                      (status IN ('HELD','CONFIRMED') OR (status = 'CANCELLED' AND refunded_at IS NULL)) AS counted
                 FROM room_bookings
                WHERE organisation_id = $1 AND deleted_at IS NULL AND advance_paid > 0) b`,
      [organisationId],
    );
    const advancesPaise = Number(adv.paise);
    const balancesPaise = entries.reduce((s2, e) => s2 + e.paise, 0);
    const openingPaise = balancesPaise - advancesPaise; // may be negative

    const nameOf = (id: string) => accounts.find((a) => a.id === id)!;
    const lines: OpeningPreviewLine[] = entries.map((e) => ({
      accountId: e.accountId, name: nameOf(e.accountId).name, kind: nameOf(e.accountId).kind,
      debit: rupees(e.paise), credit: '0.00',
    }));
    if (advancesPaise > 0) {
      lines.push({ accountId: advancesAcc.id, name: 'Patient advances', kind: 'patient_advances', debit: '0.00', credit: rupees(advancesPaise) });
    }
    if (openingPaise !== 0) {
      lines.push({
        accountId: openingAcc.id, name: 'Opening balance', kind: 'opening_balance',
        debit: openingPaise < 0 ? rupees(-openingPaise) : '0.00',
        credit: openingPaise > 0 ? rupees(openingPaise) : '0.00',
      });
    }

    return {
      goLiveDate,
      alreadyLive: s?.live_from ?? null,
      lines,
      totals: { balances: rupees(balancesPaise), patientAdvances: rupees(advancesPaise), openingBalance: rupees(openingPaise) },
      advances: {
        bookings: adv.bookings, amount: rupees(advancesPaise),
        noShowNotCounted: { bookings: adv.no_show, amount: rupees(Number(adv.no_show_paise)) },
      },
    };
  }

  private assertClinic(actor: CashActor) {
    if (actor.organisationType !== 'CLINIC' || !actor.organisationId) {
      throw new ForbiddenException('Cash tracking is only available to clinics');
    }
  }

  private assertGoLiveRole(actor: CashActor) {
    this.assertClinic(actor);
    if (!GO_LIVE_ROLES.includes(actor.role ?? '')) {
      throw new ForbiddenException('Only the owner or an admin can set up cash tracking');
    }
  }

  // Rollout control: Ayurlahi enables cash tracking per clinic
  // (organisation_settings.cash_module_enabled, no API); go-live is one-way.
  private async assertEnabled(m: EntityManager, organisationId: string) {
    const [s] = await m.query(
      `SELECT cash_module_enabled AS enabled FROM organisation_settings WHERE organisation_id = $1`,
      [organisationId],
    );
    if (!s?.enabled) throw new ForbiddenException(NOT_ENABLED);
  }
}
