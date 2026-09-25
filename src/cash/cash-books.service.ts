import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { organisationBusinessDate } from '../common/business-date';
import { CashActor } from './cash-go-live.service';
import { displayVoucherNumber, VoucherType } from './voucher-posting.service';
import { ledgerBalances } from './ledger-balances';

// Read-only books over the vouchers (scope/Cash_Books_Implementation_2026-09-25.md):
// Cash Today, Day Book, Cash Book and one voucher. Balances are always summed
// from voucher_lines, never stored (plan D9), and all maths is in paise.
//
// Leadership only (plan §8 "Reports"). OWNER/ADMIN/MANAGER are never
// branch-restricted, so branchId is only the branch switcher: it narrows
// within the caller's own organisation and can never widen.

const BOOK_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];
// Where money physically is.
export const BALANCE_KINDS = ['cash', 'bank', 'upi', 'held_by_partner'];
const VOUCHER_TYPES: VoucherType[] = ['receipt', 'payment', 'contra', 'journal'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BOOK_DAYS = 366;

const rupees = (p: number) => (p / 100).toFixed(2);
const paise = (v: unknown) => Number(v ?? 0);

export interface CashEffect {
  accountId: string;
  name: string;
  kind: string;
  // + money came into this ledger, − money left it.
  amount: string;
}

export interface BookVoucher {
  id: string;
  displayNumber: string;
  voucherType: VoucherType;
  voucherDate: string;
  originalDate: string | null;
  narration: string;
  sourceType: string;
  branchId: string | null;
  createdAt: string;
  createdBy: string | null;
  total: string;
  reversalOf: { id: string; displayNumber: string } | null;
  reversedBy: { id: string; displayNumber: string } | null;
  reversalReason: string | null;
  cashEffect: CashEffect[];
  lines: Array<{ accountId: string; name: string; kind: string; branchId: string | null; debit: string; credit: string; description: string | null }>;
}

@Injectable()
export class CashBooksService {
  constructor(private readonly dataSource: DataSource) {}

  // Cash Today: where the money is at the end of `date`, and what moved that day.
  async today(actor: CashActor, date?: string, branchId?: string) {
    const m = this.dataSource.manager;
    const ctx = await this.context(m, actor, date, branchId);
    if (!ctx.liveFrom) return { live: false as const, date: ctx.date };

    // Per ledger: the whole ledger's balance (a bank account has one balance,
    // from the shared ledgerBalances), but the day's in/out only counts lines
    // of the selected branch.
    const flows: Array<{ id: string; name: string; kind: string; branch_id: string | null; is_active: boolean; day_in: string; day_out: string }> =
      await m.query(
        `SELECT a.id, a.name, a.kind, a.branch_id, a.is_active,
                COALESCE(round(sum(l.debit)  FILTER (WHERE v.voucher_date = $2 AND ($3::uuid IS NULL OR l.branch_id = $3)) * 100), 0)::bigint AS day_in,
                COALESCE(round(sum(l.credit) FILTER (WHERE v.voucher_date = $2 AND ($3::uuid IS NULL OR l.branch_id = $3)) * 100), 0)::bigint AS day_out
           FROM accounts a
           LEFT JOIN voucher_lines l ON l.account_id = a.id AND l.organisation_id = a.organisation_id
           LEFT JOIN vouchers v ON v.id = l.voucher_id AND v.organisation_id = a.organisation_id
          WHERE a.organisation_id = $1 AND a.kind = ANY($4::text[])
            AND ($3::uuid IS NULL OR a.branch_id IS NULL OR a.branch_id = $3)
          GROUP BY a.id
          ORDER BY array_position($4::text[], a.kind::text), a.name`,
        [actor.organisationId, ctx.date, ctx.branchId, BALANCE_KINDS],
      );
    const ids = flows.map((f) => f.id);
    const opening = await ledgerBalances(m, actor.organisationId, ids, { before: ctx.date });
    const closing = await ledgerBalances(m, actor.organisationId, ids, { upTo: ctx.date });
    // A switched-off place is listed only while it still holds money.
    const rows = flows
      .filter((f) => f.is_active || closing.get(f.id) !== 0)
      .map((f) => ({ ...f, opening: opening.get(f.id)!, closing: closing.get(f.id)! }));

    // Headline totals: patient/other receipts and payments only. Transfers
    // (contra) and journals (opening, advance moved to a bill) aren't money
    // received or spent. A reversal keeps its original's type and nets out.
    const [totals] = await m.query(
      `SELECT COALESCE(round(sum(l.debit - l.credit) FILTER (WHERE v.voucher_type = 'receipt') * 100), 0)::bigint AS received,
              COALESCE(round(sum(l.credit - l.debit) FILTER (WHERE v.voucher_type = 'payment') * 100), 0)::bigint AS paid_out
         FROM vouchers v
         JOIN voucher_lines l ON l.voucher_id = v.id AND l.organisation_id = v.organisation_id
         JOIN accounts a ON a.id = l.account_id AND a.organisation_id = l.organisation_id
        WHERE v.organisation_id = $1 AND v.voucher_date = $2 AND a.kind = ANY($4::text[])
          AND ($3::uuid IS NULL OR l.branch_id = $3)`,
      [actor.organisationId, ctx.date, ctx.branchId, BALANCE_KINDS],
    );
    const counts: Array<{ voucher_type: string; n: number }> = await m.query(
      `SELECT v.voucher_type, count(*)::int AS n FROM vouchers v
        WHERE v.organisation_id = $1 AND v.voucher_date = $2 AND ${this.voucherBranchFilter('$3')}
        GROUP BY v.voucher_type`,
      [actor.organisationId, ctx.date, ctx.branchId],
    );
    // Money held for patients who have paid an advance but not yet checked in.
    const [adv] = await m.query(
      `SELECT COALESCE(round(sum(l.credit - l.debit) * 100), 0)::bigint AS held
         FROM voucher_lines l
         JOIN vouchers v ON v.id = l.voucher_id AND v.organisation_id = l.organisation_id
         JOIN accounts a ON a.id = l.account_id AND a.organisation_id = l.organisation_id
        WHERE l.organisation_id = $1 AND a.kind = 'patient_advances' AND v.voucher_date <= $2
          AND ($3::uuid IS NULL OR l.branch_id = $3)`,
      [actor.organisationId, ctx.date, ctx.branchId],
    );

    const ledgers = rows.map((r) => ({
      accountId: r.id, name: r.name, kind: r.kind, branchId: r.branch_id,
      opening: rupees(r.opening), in: rupees(paise(r.day_in)),
      out: rupees(paise(r.day_out)), closing: rupees(r.closing),
    }));
    const sumKind = (kinds: string[]) =>
      rupees(rows.filter((r) => kinds.includes(r.kind)).reduce((s, r) => s + r.closing, 0));
    return {
      live: true as const,
      liveFrom: ctx.liveFrom,
      date: ctx.date,
      isToday: ctx.date === ctx.today,
      received: rupees(paise(totals?.received)),
      paidOut: rupees(paise(totals?.paid_out)),
      voucherCounts: Object.fromEntries(VOUCHER_TYPES.map((t) => [t, counts.find((c) => c.voucher_type === t)?.n ?? 0])),
      patientAdvancesHeld: rupees(paise(adv?.held)),
      closingBy: { cash: sumKind(['cash']), bankAndUpi: sumKind(['bank', 'upi']), heldByPartners: sumKind(['held_by_partner']) },
      ledgers,
    };
  }

  // Day Book: every voucher dated `date`, oldest first.
  async dayBook(actor: CashActor, date?: string, branchId?: string, type?: string) {
    const m = this.dataSource.manager;
    const ctx = await this.context(m, actor, date, branchId);
    if (type && !VOUCHER_TYPES.includes(type as VoucherType)) {
      throw new BadRequestException(`type must be one of ${VOUCHER_TYPES.join(', ')}`);
    }
    if (!ctx.liveFrom) return { live: false as const, date: ctx.date, vouchers: [] };
    const ids: Array<{ id: string }> = await m.query(
      `SELECT v.id FROM vouchers v
        WHERE v.organisation_id = $1 AND v.voucher_date = $2 AND ${this.voucherBranchFilter('$3')}
          AND ($4::text IS NULL OR v.voucher_type = $4)
        ORDER BY v.created_at, v.voucher_type, v.voucher_number`,
      [actor.organisationId, ctx.date, ctx.branchId, type ?? null],
    );
    return {
      live: true as const,
      date: ctx.date,
      isToday: ctx.date === ctx.today,
      vouchers: await this.loadVouchers(m, actor.organisationId, ids.map((r) => r.id)),
    };
  }

  // Cash Book: one cash/bank/UPI/partner-held ledger with a running balance.
  async ledgerBook(actor: CashActor, accountId: string, from?: string, to?: string) {
    const m = this.dataSource.manager;
    const ctx = await this.context(m, actor, to);
    if (!UUID_RE.test(accountId ?? '')) throw new NotFoundException('Ledger not found');
    const [acc] = await m.query(
      `SELECT id, name, kind, branch_id, is_active FROM accounts WHERE id = $1 AND organisation_id = $2`,
      [accountId, actor.organisationId],
    );
    if (!acc || !BALANCE_KINDS.includes(acc.kind)) throw new NotFoundException('Ledger not found');

    const toDate = ctx.date;
    const fromDate = from ?? `${toDate.slice(0, 8)}01`;
    this.assertDate(fromDate, 'from');
    if (fromDate > toDate) throw new BadRequestException('"from" must be on or before "to"');
    const days = (Date.parse(toDate) - Date.parse(fromDate)) / 86_400_000;
    if (days > MAX_BOOK_DAYS) throw new BadRequestException(`Pick a range of at most ${MAX_BOOK_DAYS} days`);

    const ledger = { accountId: acc.id, name: acc.name, kind: acc.kind, branchId: acc.branch_id, isActive: acc.is_active };
    if (!ctx.liveFrom) return { live: false as const, from: fromDate, to: toDate, ledger, opening: '0.00', closing: '0.00', rows: [] };

    const open = (await ledgerBalances(m, actor.organisationId, [acc.id], { before: fromDate })).get(acc.id)!;
    const lines: Array<{ voucher_id: string; voucher_type: VoucherType; voucher_number: number; fy_start_year: number; voucher_date: string; narration: string; source_type: string; description: string | null; debit: string; credit: string }> =
      await m.query(
        `SELECT v.id AS voucher_id, v.voucher_type, v.voucher_number, v.fy_start_year,
                to_char(v.voucher_date, 'YYYY-MM-DD') AS voucher_date, v.narration, v.source_type,
                l.description,
                round(l.debit * 100)::bigint AS debit, round(l.credit * 100)::bigint AS credit
           FROM voucher_lines l JOIN vouchers v ON v.id = l.voucher_id AND v.organisation_id = l.organisation_id
          WHERE l.organisation_id = $1 AND l.account_id = $2 AND v.voucher_date BETWEEN $3 AND $4
          ORDER BY v.voucher_date, v.created_at, v.voucher_type, v.voucher_number, l.line_no`,
        [actor.organisationId, acc.id, fromDate, toDate],
      );
    let running = open;
    const rows = lines.map((l) => {
      running += paise(l.debit) - paise(l.credit);
      return {
        voucherId: l.voucher_id,
        displayNumber: displayVoucherNumber(l.voucher_type, l.fy_start_year, l.voucher_number),
        voucherType: l.voucher_type,
        voucherDate: l.voucher_date,
        narration: l.description || l.narration,
        sourceType: l.source_type,
        in: rupees(paise(l.debit)),
        out: rupees(paise(l.credit)),
        balance: rupees(running),
      };
    });
    return { live: true as const, from: fromDate, to: toDate, ledger, opening: rupees(open), closing: rupees(running), rows };
  }

  async voucher(actor: CashActor, voucherId: string): Promise<BookVoucher> {
    const m = this.dataSource.manager;
    this.assertBookRole(actor);
    if (!UUID_RE.test(voucherId ?? '')) throw new NotFoundException('Voucher not found');
    const [v] = await this.loadVouchers(m, actor.organisationId, [voucherId]);
    if (!v) throw new NotFoundException('Voucher not found');
    return v;
  }

  // Vouchers with their lines, names and reversal links, in the order given.
  private async loadVouchers(m: EntityManager, organisationId: string, ids: string[]): Promise<BookVoucher[]> {
    if (!ids.length) return [];
    const vs: any[] = await m.query(
      `SELECT v.id, v.voucher_type, v.voucher_number, v.fy_start_year,
              to_char(v.voucher_date, 'YYYY-MM-DD') AS voucher_date,
              to_char(v.original_date, 'YYYY-MM-DD') AS original_date,
              v.narration, v.source_type, v.branch_id, v.created_at, v.reversal_reason,
              NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), '') AS created_by_name,
              o.id AS orig_id, o.voucher_type AS orig_type, o.voucher_number AS orig_number, o.fy_start_year AS orig_fy,
              r.id AS rev_id, r.voucher_type AS rev_type, r.voucher_number AS rev_number, r.fy_start_year AS rev_fy
         FROM vouchers v
         LEFT JOIN users u ON u.id = v.created_by
         LEFT JOIN vouchers o ON o.id = v.reversal_of AND o.organisation_id = v.organisation_id
         LEFT JOIN vouchers r ON r.reversal_of = v.id AND r.organisation_id = v.organisation_id
        WHERE v.organisation_id = $1 AND v.id = ANY($2::uuid[])`,
      [organisationId, ids],
    );
    const ls: any[] = await m.query(
      `SELECT l.voucher_id, l.account_id, a.name, a.kind, l.branch_id, l.description,
              round(l.debit * 100)::bigint AS debit, round(l.credit * 100)::bigint AS credit
         FROM voucher_lines l JOIN accounts a ON a.id = l.account_id AND a.organisation_id = l.organisation_id
        WHERE l.organisation_id = $1 AND l.voucher_id = ANY($2::uuid[])
        ORDER BY l.voucher_id, l.line_no`,
      [organisationId, ids],
    );
    const byId = new Map(vs.map((v) => [v.id, v]));
    return ids.filter((id) => byId.has(id)).map((id) => {
      const v = byId.get(id);
      const mine = ls.filter((l) => l.voucher_id === id);
      const total = mine.reduce((s, l) => s + paise(l.debit), 0);
      return {
        id: v.id,
        displayNumber: displayVoucherNumber(v.voucher_type, v.fy_start_year, v.voucher_number),
        voucherType: v.voucher_type,
        voucherDate: v.voucher_date,
        originalDate: v.original_date,
        narration: v.narration,
        sourceType: v.source_type,
        branchId: v.branch_id,
        createdAt: new Date(v.created_at).toISOString(),
        createdBy: v.created_by_name,
        total: rupees(total),
        reversalOf: v.orig_id ? { id: v.orig_id, displayNumber: displayVoucherNumber(v.orig_type, v.orig_fy, v.orig_number) } : null,
        reversedBy: v.rev_id ? { id: v.rev_id, displayNumber: displayVoucherNumber(v.rev_type, v.rev_fy, v.rev_number) } : null,
        reversalReason: v.reversal_reason,
        cashEffect: mine
          .filter((l) => BALANCE_KINDS.includes(l.kind))
          .map((l) => ({ accountId: l.account_id, name: l.name, kind: l.kind, amount: rupees(paise(l.debit) - paise(l.credit)) })),
        lines: mine.map((l) => ({
          accountId: l.account_id, name: l.name, kind: l.kind, branchId: l.branch_id,
          debit: rupees(paise(l.debit)), credit: rupees(paise(l.credit)), description: l.description,
        })),
      };
    });
  }

  // A voucher belongs to a branch when it or any of its lines is tagged with it.
  private voucherBranchFilter(param: string): string {
    return `(${param}::uuid IS NULL OR v.branch_id = ${param}::uuid OR EXISTS (
              SELECT 1 FROM voucher_lines bl WHERE bl.voucher_id = v.id AND bl.branch_id = ${param}::uuid))`;
  }

  private async context(m: EntityManager, actor: CashActor, date?: string, branchId?: string) {
    this.assertBookRole(actor);
    if (date) this.assertDate(date, 'date');
    if (branchId && !UUID_RE.test(branchId)) throw new BadRequestException('branchId must be a UUID');
    const today = await organisationBusinessDate(m, actor.organisationId);
    const [s] = await m.query(
      `SELECT to_char(cash_module_live_from, 'YYYY-MM-DD') AS live_from FROM organisation_settings WHERE organisation_id = $1`,
      [actor.organisationId],
    );
    return { today, date: date ?? today, branchId: branchId || null, liveFrom: (s?.live_from as string | null) ?? null };
  }

  private assertDate(value: string, field: string) {
    if (!DATE_RE.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
      throw new BadRequestException(`${field} must be a date (YYYY-MM-DD)`);
    }
  }

  private assertBookRole(actor: CashActor) {
    if (actor.organisationType !== 'CLINIC' || !actor.organisationId) {
      throw new ForbiddenException('Cash tracking is only available to clinics');
    }
    if (!BOOK_ROLES.includes(actor.role ?? '')) {
      throw new ForbiddenException('Cash books are only available to the owner, an admin or a manager');
    }
  }
}
