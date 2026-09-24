import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { organisationBusinessDate } from '../common/business-date';

// The one entry point that writes money records (Cash MVP plan D3). Every
// caller passes its own EntityManager, so the voucher commits or rolls back
// with the source write (payment, expense, refund...). The database enforces
// the same invariants as a backstop (migration 2026-09-25-cash-management-mvp.sql,
// scope/Cash_MVP_Schema_Review_2026-09-24.md); this service checks first so
// callers get a clear 4xx instead of a trigger error at commit.
//
// Lock order, the same in every transaction (review §3): the caller's source
// row first, then the accounts (FOR SHARE, id order), then the counter row.

export type VoucherType = 'receipt' | 'payment' | 'contra' | 'journal';

export type VoucherSourceType =
  | 'patient_payment'
  | 'booking_advance'
  | 'advance_transfer'
  | 'booking_refund'
  | 'bill_payment'
  | 'asset_maintenance'
  | 'expense'
  | 'reimbursement'
  | 'money_in'
  | 'transfer'
  | 'day_close'
  | 'opening';

const VOUCHER_TYPES: VoucherType[] = ['receipt', 'payment', 'contra', 'journal'];
const SOURCE_TYPES: VoucherSourceType[] = [
  'patient_payment', 'booking_advance', 'advance_transfer', 'booking_refund',
  'bill_payment', 'asset_maintenance', 'expense', 'reimbursement',
  'money_in', 'transfer', 'day_close', 'opening',
];
const PREFIX: Record<VoucherType, string> = {
  receipt: 'RV', payment: 'PV', contra: 'CV', journal: 'JV',
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface VoucherLineInput {
  accountId: string;
  debit?: number;
  credit?: number;
  // NULL / omitted = organisation-wide (ADR-004 D9).
  branchId?: string | null;
  description?: string | null;
}

export interface PostVoucherInput {
  organisationId: string;
  voucherType: VoucherType;
  // Business date. Defaults to today in the organisation's timezone (G9).
  voucherDate?: string;
  // Late entry: the day it really happened (must be before voucherDate).
  originalDate?: string | null;
  branchId?: string | null;
  narration: string;
  sourceType: VoucherSourceType;
  // The source row (payment, expense...). One live posting per source.
  sourceId?: string | null;
  // One per client submit, for entries with no source row (Money In, Transfer...).
  idempotencyKey?: string | null;
  evidenceUrl?: string | null;
  noBillDeclaration?: Record<string, unknown> | null;
  lines: VoucherLineInput[];
  createdBy: string;
  actorRole?: string | null;
  // Manual entries fail when the module is off; source-driven posts are skipped.
  requireLive?: boolean;
}

export interface ReverseVoucherInput {
  organisationId: string;
  voucherId: string;
  reason: string;
  createdBy: string;
  actorRole?: string | null;
}

export interface PostedVoucher {
  id: string;
  voucherType: VoucherType;
  voucherNumber: number;
  fyStartYear: number;
  voucherDate: string;
  displayNumber: string;
  // true when an earlier posting for the same source / idempotency key was returned.
  replayed: boolean;
}

type Paise = number;

interface CheckedLine {
  accountId: string;
  branchId: string | null;
  debit: Paise;
  credit: Paise;
  description: string | null;
}

export function displayVoucherNumber(type: VoucherType, fyStartYear: number, n: number): string {
  const fy = `${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, '0')}`;
  return `${PREFIX[type]}/${fy}/${String(n).padStart(6, '0')}`;
}

function toPaise(value: unknown, field: string): Paise {
  if (value === undefined || value === null) return 0;
  const n = typeof value === 'string' ? Number(value) : (value as number);
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
    throw new BadRequestException(`${field} must be a non-negative amount`);
  }
  const paise = Math.round(n * 100);
  if (Math.abs(n * 100 - paise) > 1e-6) {
    throw new BadRequestException(`${field} can have at most 2 decimal places`);
  }
  return paise;
}

const rupees = (p: Paise) => (p / 100).toFixed(2);

@Injectable()
export class VoucherPostingService {
  constructor(private readonly auditService: AuditService) {}

  // Returns null when the organisation's cash module is off or the date is
  // before go-live (unless requireLive, which throws instead).
  async post(manager: EntityManager, input: PostVoucherInput): Promise<PostedVoucher | null> {
    if (!SOURCE_TYPES.includes(input.sourceType)) {
      throw new BadRequestException(`Unknown voucher source '${input.sourceType}'`);
    }
    return this.write(manager, input, null);
  }

  // The organisation's go-live date ('YYYY-MM-DD'), or null while the cash
  // module is off. Callers use it to skip money dated before go-live.
  async liveFrom(manager: EntityManager, organisationId: string): Promise<string | null> {
    const [settings] = await manager.query(
      `SELECT to_char(cash_module_live_from, 'YYYY-MM-DD') AS live_from
         FROM organisation_settings WHERE organisation_id = $1`,
      [organisationId],
    );
    return settings?.live_from ?? null;
  }

  // Corrections are reversals only: same lines, sides swapped, dated today.
  async reverse(manager: EntityManager, input: ReverseVoucherInput): Promise<PostedVoucher> {
    const reason = input.reason?.trim();
    if (!reason) throw new BadRequestException('A reason is required to reverse a voucher');

    const [original] = await manager.query(
      `SELECT id, voucher_type, source_type, branch_id, narration
         FROM vouchers WHERE id = $1 AND organisation_id = $2 FOR UPDATE`,
      [input.voucherId, input.organisationId],
    );
    if (!original) throw new NotFoundException('Voucher not found');
    if (original.source_type === 'reversal') {
      throw new BadRequestException('A reversal cannot itself be reversed');
    }
    const [existing] = await manager.query(
      `SELECT id FROM vouchers WHERE reversal_of = $1`,
      [original.id],
    );
    if (existing) throw new ConflictException('This voucher has already been reversed');

    const lines = await manager.query(
      `SELECT account_id, branch_id, debit, credit, description
         FROM voucher_lines WHERE voucher_id = $1 ORDER BY line_no`,
      [original.id],
    );
    const posted = await this.write(
      manager,
      {
        organisationId: input.organisationId,
        voucherType: original.voucher_type,
        branchId: original.branch_id,
        narration: `Reversal: ${original.narration}`,
        sourceType: 'reversal' as VoucherSourceType,
        lines: lines.map((l: any) => ({
          accountId: l.account_id,
          branchId: l.branch_id,
          debit: Number(l.credit),
          credit: Number(l.debit),
          description: l.description,
        })),
        createdBy: input.createdBy,
        actorRole: input.actorRole,
        requireLive: true,
      },
      { reversalOf: original.id, reason },
    );
    return posted!;
  }

  private async write(
    manager: EntityManager,
    input: PostVoucherInput,
    reversal: { reversalOf: string; reason: string } | null,
  ): Promise<PostedVoucher | null> {
    const orgId = input.organisationId;
    if (!VOUCHER_TYPES.includes(input.voucherType)) {
      throw new BadRequestException(`Unknown voucher type '${input.voucherType}'`);
    }
    if (!input.narration?.trim()) throw new BadRequestException('Narration is required');
    if (!input.createdBy) throw new BadRequestException('createdBy is required');
    const lines = this.checkLines(input.lines);

    const voucherDate = input.voucherDate ?? (await organisationBusinessDate(manager, orgId));
    if (!DATE_RE.test(voucherDate)) throw new BadRequestException('voucherDate must be YYYY-MM-DD');
    if (input.originalDate != null) {
      if (!DATE_RE.test(input.originalDate) || input.originalDate >= voucherDate) {
        throw new BadRequestException('originalDate must be a YYYY-MM-DD date before the voucher date');
      }
    }

    // Module-off switch and go-live date (plan §7, D10).
    const liveFrom = await this.liveFrom(manager, orgId);
    if (!liveFrom || voucherDate < liveFrom) {
      if (input.requireLive) {
        throw new BadRequestException(
          liveFrom
            ? `Cash tracking starts on ${liveFrom}; this entry is dated ${voucherDate}`
            : 'Cash tracking is not switched on for this organisation',
        );
      }
      return null;
    }

    // Idempotent replay: the same source or submit returns the voucher already posted.
    if (!reversal && (input.sourceId || input.idempotencyKey)) {
      const [prior] = await manager.query(
        `SELECT id, voucher_type, voucher_number, fy_start_year,
                to_char(voucher_date, 'YYYY-MM-DD') AS voucher_date
           FROM vouchers
          WHERE organisation_id = $1
            AND ((source_type = $2 AND source_id = $3) OR idempotency_key = $4)
          LIMIT 1`,
        [orgId, input.sourceType, input.sourceId ?? null, input.idempotencyKey ?? null],
      );
      if (prior) return this.toPosted(prior, true);
    }

    // Accounts: must exist in this organisation and be active. Another
    // organisation's account is reported as not found, never as "not yours".
    const accountIds = [...new Set(lines.map((l) => l.accountId))].sort();
    const accounts: Array<{ id: string; organisation_id: string; is_active: boolean; name: string }> =
      await manager.query(
        `SELECT id, organisation_id, is_active, name FROM accounts
          WHERE id = ANY($1::uuid[]) ORDER BY id FOR SHARE`,
        [accountIds],
      );
    for (const id of accountIds) {
      const a = accounts.find((x) => x.id === id);
      if (!a || a.organisation_id !== orgId) throw new NotFoundException('Ledger not found in this organisation');
      if (!a.is_active) throw new BadRequestException(`Ledger "${a.name}" is inactive`);
    }

    const branchIds = [...new Set([input.branchId, ...lines.map((l) => l.branchId)].filter(Boolean))] as string[];
    if (branchIds.length) {
      const found = await manager.query(
        `SELECT id FROM branches WHERE id = ANY($1::uuid[]) AND organisation_id = $2 AND deleted_at IS NULL`,
        [branchIds, orgId],
      );
      if (found.length !== branchIds.length) throw new NotFoundException('Branch not found in this organisation');
    }

    // Day lock (plan D11). The trigger enforces the same rule, including the
    // one exception: a day close's own variance voucher.
    const [closed] = await manager.query(
      `SELECT a.name, to_char(dc.close_date, 'YYYY-MM-DD') AS close_date
         FROM day_closes dc JOIN accounts a ON a.id = dc.account_id
        WHERE dc.account_id = ANY($1::uuid[]) AND dc.close_date >= $2::date
          AND dc.status <> 'rejected'
          AND NOT ($3 = 'day_close' AND dc.id = $4::uuid)
        ORDER BY dc.close_date DESC LIMIT 1`,
      [accountIds, voucherDate, input.sourceType, input.sourceId ?? null],
    );
    if (closed) {
      throw new ConflictException(
        `${closed.name} is closed up to ${closed.close_date}, so nothing more can be recorded in it on or before that day.`,
      );
    }

    // Gap-free number: the counter row stays locked until this transaction ends.
    const fy = Number(voucherDate.slice(0, 4)) - (Number(voucherDate.slice(5, 7)) >= 4 ? 0 : 1);
    const [{ last_number: n }] = await manager.query(
      `INSERT INTO voucher_counters (organisation_id, voucher_type, fy_start_year, last_number)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (organisation_id, voucher_type, fy_start_year)
       DO UPDATE SET last_number = voucher_counters.last_number + 1
       RETURNING last_number`,
      [orgId, input.voucherType, fy],
    );

    let row: any;
    try {
      [row] = await manager.query(
        `INSERT INTO vouchers (organisation_id, branch_id, voucher_type, voucher_number, voucher_date,
                               original_date, narration, source_type, source_id, idempotency_key,
                               reversal_of, reversal_reason, evidence_url, no_bill_declaration, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING id, voucher_type, voucher_number, fy_start_year, to_char(voucher_date, 'YYYY-MM-DD') AS voucher_date`,
        [
          orgId, input.branchId ?? null, input.voucherType, n, voucherDate,
          input.originalDate ?? null, input.narration.trim(),
          reversal ? 'reversal' : input.sourceType, reversal ? null : input.sourceId ?? null,
          reversal ? null : input.idempotencyKey ?? null,
          reversal?.reversalOf ?? null, reversal?.reason ?? null,
          input.evidenceUrl ?? null,
          input.noBillDeclaration ? JSON.stringify(input.noBillDeclaration) : null,
          input.createdBy,
        ],
      );
      const values: unknown[] = [];
      const tuples = lines.map((l, i) => {
        const b = values.length;
        values.push(row.id, orgId, i + 1, l.accountId, l.branchId, rupees(l.debit), rupees(l.credit), l.description);
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`;
      });
      await manager.query(
        `INSERT INTO voucher_lines (voucher_id, organisation_id, line_no, account_id, branch_id, debit, credit, description)
         VALUES ${tuples.join(',')}`,
        values,
      );
    } catch (err: any) {
      throw this.mapDbError(err);
    }

    const total = lines.reduce((s, l) => s + l.debit, 0);
    await this.auditService.record(
      {
        organisationId: orgId,
        branchId: input.branchId ?? null,
        orgType: 'CLINIC',
        entityType: 'voucher',
        entityId: row.id,
        action: 'create',
        severity: 'critical',
        actorUserId: input.createdBy,
        actorRole: input.actorRole ?? null,
        source: 'api',
        reason: reversal?.reason ?? null,
        metadata: {
          number: displayVoucherNumber(input.voucherType, row.fy_start_year, row.voucher_number),
          voucherType: input.voucherType,
          sourceType: reversal ? 'reversal' : input.sourceType,
          sourceId: reversal ? null : input.sourceId ?? null,
          reversalOf: reversal?.reversalOf ?? null,
          amount: rupees(total),
        },
      },
      manager,
    );

    return this.toPosted(row, false);
  }

  private checkLines(input: VoucherLineInput[]): CheckedLine[] {
    if (!Array.isArray(input) || input.length < 2) {
      throw new BadRequestException('A voucher needs at least two lines');
    }
    const lines = input.map((l, i) => {
      if (!l?.accountId) throw new BadRequestException(`Line ${i + 1} has no ledger`);
      const debit = toPaise(l.debit, `Line ${i + 1} debit`);
      const credit = toPaise(l.credit, `Line ${i + 1} credit`);
      if ((debit > 0) === (credit > 0)) {
        throw new BadRequestException(`Line ${i + 1} must have either a debit or a credit amount`);
      }
      return { accountId: l.accountId, branchId: l.branchId ?? null, debit, credit, description: l.description ?? null };
    });
    const dr = lines.reduce((s, l) => s + l.debit, 0);
    const cr = lines.reduce((s, l) => s + l.credit, 0);
    if (dr !== cr) {
      throw new BadRequestException(`Voucher does not balance: debit ${rupees(dr)}, credit ${rupees(cr)}`);
    }
    return lines;
  }

  // A concurrent request can still win the race between the replay check and
  // the insert; the unique indexes catch it.
  private mapDbError(err: any): Error {
    const c = err?.constraint;
    if (err?.code === '23505' && (c === 'uq_vouchers_source' || c === 'uq_vouchers_idem')) {
      return new ConflictException('This entry has already been recorded');
    }
    if (err?.code === '23505' && c === 'vouchers_reversal_of_key') {
      return new ConflictException('This voucher has already been reversed');
    }
    if (err?.code === '23514' && /is closed/.test(err?.message ?? '')) {
      return new ConflictException(err.message);
    }
    return err;
  }

  private toPosted(row: any, replayed: boolean): PostedVoucher {
    const fy = Number(row.fy_start_year);
    const n = Number(row.voucher_number);
    return {
      id: row.id,
      voucherType: row.voucher_type,
      voucherNumber: n,
      fyStartYear: fy,
      voucherDate: row.voucher_date,
      displayNumber: displayVoucherNumber(row.voucher_type, fy, n),
      replayed,
    };
  }
}
