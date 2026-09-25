import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { BranchVisibilityService } from '../branch-visibility/branch-visibility.service';
import { organisationBusinessDate } from '../common/business-date';
import { CashActor } from './cash-go-live.service';
import { accountsWithLines, ledgerBalances } from './ledger-balances';
import { VoucherPostingService } from './voucher-posting.service';
import { CreateLedgerDto, CreatePartnerDto, UpdateLedgerDto, UpdatePartnerDto } from './dto/setup.dto';

// Cash Set-up (scope/Cash_Setup_Implementation_2026-09-25.md): money places
// (cash / bank / UPI), partners and expense heads. No schema change: this
// edits the accounts and partners the cash migration already has.
//
// OWNER/ADMIN read and write; MANAGER reads (no member list). Clinic orgs
// only, once Ayurlahi has enabled cash. Authorisation lives here, not in
// @Roles (T32). Nothing is ever deleted; every change is audited in the same
// transaction. Messages avoid the words that make the app log the user out
// (parent analysis §14), so "switch off", never the other word.

const WRITE_ROLES = ['OWNER', 'ADMIN'];
const READ_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];
const MONEY_KINDS = ['cash', 'bank', 'upi'];
const EDITABLE_KINDS = [...MONEY_KINDS, 'expense'];
const NOT_ENABLED = 'Cash tracking has not been enabled for this clinic yet. Contact Ayurlahi support to enable it.';
const rupees = (p: number) => (p / 100).toFixed(2);
const inr = (p: number) => `₹${(Math.abs(p) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const heldName = (partner: string) => `Held by ${partner}`;
const moneyName = (partner: string) => `${partner} – money in/out`;

@Injectable()
export class CashSetupService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly posting: VoucherPostingService,
    private readonly branchVisibility: BranchVisibilityService,
    private readonly audit: AuditService,
  ) {}

  // ── Read ───────────────────────────────────────────────────────────────

  async getSetup(actor: CashActor) {
    this.assertRole(actor, READ_ROLES);
    const m = this.dataSource.manager;
    const settings = await this.assertEnabled(m, actor.organisationId);
    const org = actor.organisationId;

    const ledgers: any[] = await m.query(
      `SELECT a.id, a.kind, a.name, a.branch_id, a.custodian_user_id, a.partner_id, a.is_active, a.system_key,
              NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), '') AS custodian_name
         FROM accounts a LEFT JOIN users u ON u.id = a.custodian_user_id
        WHERE a.organisation_id = $1 AND a.kind = ANY($2::text[])
        ORDER BY array_position($2::text[], a.kind::text), a.name`,
      [org, [...EDITABLE_KINDS, 'held_by_partner', 'partner_unclassified']],
    );
    const ids = ledgers.map((l) => l.id);
    const balances = await ledgerBalances(m, org, ids);
    const used = await accountsWithLines(m, org, ids);

    const partners: any[] = await m.query(
      `SELECT p.id, p.name, p.user_id, p.is_active,
              NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), '') AS user_name
         FROM partners p LEFT JOIN users u ON u.id = p.user_id
        WHERE p.organisation_id = $1 AND p.deleted_at IS NULL
        ORDER BY p.name`,
      [org],
    );
    const branches: Array<{ id: string; name: string }> = await m.query(
      `SELECT id, name FROM branches WHERE organisation_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
      [org],
    );

    const place = (l: any) => ({
      id: l.id, kind: l.kind, name: l.name, branchId: l.branch_id,
      custodianUserId: l.custodian_user_id, custodianName: l.custodian_name,
      isActive: l.is_active, isSystem: !!l.system_key,
      balance: rupees(balances.get(l.id) ?? 0),
      // The branch is fixed once the place has entries (its lines carry it).
      branchLocked: used.has(l.id),
    });
    const out: any = {
      liveFrom: settings.live_from,
      canEdit: WRITE_ROLES.includes(actor.role ?? ''),
      branches,
      places: ledgers.filter((l) => MONEY_KINDS.includes(l.kind)).map(place),
      expenseHeads: ledgers.filter((l) => l.kind === 'expense').map((l) => ({ id: l.id, name: l.name, isActive: l.is_active, isSystem: !!l.system_key })),
      partners: partners.map((p) => {
        const held = ledgers.find((l) => l.partner_id === p.id && l.kind === 'held_by_partner');
        const money = ledgers.find((l) => l.partner_id === p.id && l.kind === 'partner_unclassified');
        return {
          id: p.id, name: p.name, userId: p.user_id, userName: p.user_name, isActive: p.is_active,
          heldLedgerId: held?.id ?? null, moneyLedgerId: money?.id ?? null,
          // + the partner holds hospital/patient money.
          held: rupees(held ? balances.get(held.id) ?? 0 : 0),
          // Credit-normal: + the hospital owes the partner (or they put money in).
          owedToPartner: rupees(money ? -(balances.get(money.id) ?? 0) : 0),
          settlementOnly: !p.is_active && !!money?.is_active,
        };
      }),
    };
    // Member list only for those who can use the pickers (§4a).
    if (out.canEdit) out.members = await this.members(m, actor.organisationId);
    return out;
  }

  // ── Money places and expense heads ─────────────────────────────────────

  async createLedger(actor: CashActor, dto: CreateLedgerDto) {
    this.assertRole(actor, WRITE_ROLES);
    const name = this.cleanName(dto.name);
    const isMoney = MONEY_KINDS.includes(dto.kind);
    if (!EDITABLE_KINDS.includes(dto.kind)) throw new BadRequestException('Unknown ledger kind');
    if (!isMoney && dto.branchId) throw new BadRequestException('Expense heads apply to all branches');
    if (dto.kind !== 'cash' && dto.custodianUserId) throw new BadRequestException('Only a cash place has a person responsible');
    if (!isMoney && dto.openingBalance) throw new BadRequestException('Expense heads have no opening balance');

    return this.dataSource.transaction(async (m) => {
      const settings = await this.assertEnabled(m, actor.organisationId);
      const branchId = dto.branchId ?? null;
      if (branchId) await this.checkBranch(m, actor.organisationId, branchId);
      if (dto.custodianUserId) await this.checkCustodian(m, actor.organisationId, dto.custodianUserId, branchId);
      const openingPaise = Math.round((dto.openingBalance ?? 0) * 100);
      if (openingPaise > 0 && !settings.live_from) {
        throw new BadRequestException('Before go-live, enter opening amounts on the go-live step instead');
      }

      const [row] = await this.insertOrConflict(m, name,
        `INSERT INTO accounts (organisation_id, branch_id, kind, name, custodian_user_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [actor.organisationId, branchId, dto.kind, name, dto.custodianUserId ?? null, actor.userId],
      );
      const opening = openingPaise > 0
        ? await this.postOpening(m, actor, row.id, openingPaise, `Opening balance of ${name} (added after go-live)`)
        : null;
      await this.record(m, actor, 'cash_ledger', row.id, 'create', branchId, null, {
        kind: dto.kind, name, branchId, custodianUserId: dto.custodianUserId ?? null,
        openingBalance: openingPaise ? rupees(openingPaise) : null, openingVoucher: opening?.displayNumber ?? null,
      });
      return { id: row.id, openingVoucher: opening?.displayNumber ?? null };
    });
  }

  async updateLedger(actor: CashActor, id: string, dto: UpdateLedgerDto) {
    this.assertRole(actor, WRITE_ROLES);
    return this.dataSource.transaction(async (m) => {
      const settings = await this.assertEnabled(m, actor.organisationId);
      // Locks the place: posting takes FOR SHARE on it, so no entry can land
      // between the balance check and the switch-off.
      const [a] = await m.query(
        `SELECT id, kind, name, branch_id, custodian_user_id, is_active FROM accounts
          WHERE id = $1 AND organisation_id = $2 FOR UPDATE`,
        [id, actor.organisationId],
      );
      if (!a) throw new NotFoundException('Ledger not found');
      if (['held_by_partner', 'partner_unclassified'].includes(a.kind)) {
        throw new BadRequestException('Partner ledgers change with the partner');
      }
      if (!EDITABLE_KINDS.includes(a.kind)) throw new BadRequestException('This ledger is managed by the system');

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      const next = { name: a.name, branchId: a.branch_id as string | null, custodian: a.custodian_user_id as string | null, active: a.is_active as boolean };

      if (dto.name !== undefined) {
        const name = this.cleanName(dto.name);
        if (name !== a.name) { changes.name = { from: a.name, to: name }; next.name = name; }
      }
      if (dto.branchId !== undefined && (dto.branchId ?? null) !== a.branch_id) {
        if (a.kind === 'expense') throw new BadRequestException('Expense heads apply to all branches');
        if ((await accountsWithLines(m, actor.organisationId, [a.id])).size) {
          throw new BadRequestException(`"${a.name}" already has entries, so its branch can't change`);
        }
        if (dto.branchId) await this.checkBranch(m, actor.organisationId, dto.branchId);
        changes.branchId = { from: a.branch_id, to: dto.branchId ?? null };
        next.branchId = dto.branchId ?? null;
      }
      if (dto.custodianUserId !== undefined && (dto.custodianUserId ?? null) !== a.custodian_user_id) {
        if (a.kind !== 'cash') throw new BadRequestException('Only a cash place has a person responsible');
        changes.custodianUserId = { from: a.custodian_user_id, to: dto.custodianUserId ?? null };
        next.custodian = dto.custodianUserId ?? null;
      }
      // A new branch or a new custodian: the custodian must see the branch.
      if (next.custodian && (changes.branchId || changes.custodianUserId)) {
        await this.checkCustodian(m, actor.organisationId, next.custodian, next.branchId);
      }
      if (dto.isActive !== undefined && dto.isActive !== a.is_active) {
        if (!dto.isActive) await this.checkCanSwitchOff(m, actor.organisationId, a, !!settings.live_from);
        changes.isActive = { from: a.is_active, to: dto.isActive };
        next.active = dto.isActive;
      }
      if (!Object.keys(changes).length) return { id: a.id, changed: false };

      await this.updateLedgerRow(m, a.id, next.name, next.branchId, next.custodian, next.active);
      await this.record(m, actor, 'cash_ledger', a.id, 'update', next.branchId, changes, { kind: a.kind });
      return { id: a.id, changed: true };
    });
  }

  // ── Partners ───────────────────────────────────────────────────────────

  async createPartner(actor: CashActor, dto: CreatePartnerDto) {
    this.assertRole(actor, WRITE_ROLES);
    const name = this.cleanName(dto.name, 120);
    return this.dataSource.transaction(async (m) => {
      const settings = await this.assertEnabled(m, actor.organisationId);
      if (dto.userId) await this.checkPartnerUser(m, actor.organisationId, dto.userId, null);
      const openingPaise = Math.round((dto.openingHeldBalance ?? 0) * 100);
      if (openingPaise > 0 && !settings.live_from) {
        throw new BadRequestException('Before go-live, enter what partners hold on the go-live step instead');
      }

      const [p] = await this.insertOrConflict(m, name,
        `INSERT INTO partners (organisation_id, name, user_id, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
        [actor.organisationId, name, dto.userId ?? null, actor.userId],
      );
      // Both ledgers or neither: the transaction rolls back on any failure.
      const [held] = await this.insertOrConflict(m, heldName(name),
        `INSERT INTO accounts (organisation_id, kind, name, partner_id, created_by)
         VALUES ($1, 'held_by_partner', $2, $3, $4) RETURNING id`,
        [actor.organisationId, heldName(name), p.id, actor.userId],
      );
      const [money] = await this.insertOrConflict(m, moneyName(name),
        `INSERT INTO accounts (organisation_id, kind, name, partner_id, created_by)
         VALUES ($1, 'partner_unclassified', $2, $3, $4) RETURNING id`,
        [actor.organisationId, moneyName(name), p.id, actor.userId],
      );
      const opening = openingPaise > 0
        ? await this.postOpening(m, actor, held.id, openingPaise, `Patient money held by ${name} when added`)
        : null;
      await this.record(m, actor, 'cash_partner', p.id, 'create', null, null, {
        name, userId: dto.userId ?? null, heldLedgerId: held.id, moneyLedgerId: money.id,
        openingHeld: openingPaise ? rupees(openingPaise) : null, openingVoucher: opening?.displayNumber ?? null,
      });
      return { id: p.id, heldLedgerId: held.id, moneyLedgerId: money.id, openingVoucher: opening?.displayNumber ?? null };
    });
  }

  async updatePartner(actor: CashActor, id: string, dto: UpdatePartnerDto) {
    this.assertRole(actor, WRITE_ROLES);
    return this.dataSource.transaction(async (m) => {
      await this.assertEnabled(m, actor.organisationId);
      const [p] = await m.query(
        `SELECT id, name, user_id, is_active FROM partners
          WHERE id = $1 AND organisation_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [id, actor.organisationId],
      );
      if (!p) throw new NotFoundException('Partner not found');
      const ledgers: Array<{ id: string; kind: string; is_active: boolean }> = await m.query(
        `SELECT id, kind, is_active FROM accounts WHERE organisation_id = $1 AND partner_id = $2 ORDER BY id FOR UPDATE`,
        [actor.organisationId, p.id],
      );
      const held = ledgers.find((l) => l.kind === 'held_by_partner');
      const money = ledgers.find((l) => l.kind === 'partner_unclassified');
      if (!held || !money) throw new BadRequestException('This partner\'s ledgers are incomplete');

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      let name = p.name as string;
      if (dto.name !== undefined) {
        const n = this.cleanName(dto.name, 120);
        if (n !== p.name) {
          changes.name = { from: p.name, to: n };
          name = n;
          await this.insertOrConflict(m, n, `UPDATE partners SET name = $2 WHERE id = $1 RETURNING id`, [p.id, n]);
          await this.insertOrConflict(m, heldName(n), `UPDATE accounts SET name = $2 WHERE id = $1 RETURNING id`, [held.id, heldName(n)]);
          await this.insertOrConflict(m, moneyName(n), `UPDATE accounts SET name = $2 WHERE id = $1 RETURNING id`, [money.id, moneyName(n)]);
        }
      }
      if (dto.userId !== undefined && (dto.userId ?? null) !== p.user_id) {
        if (dto.userId) await this.checkPartnerUser(m, actor.organisationId, dto.userId, p.id);
        await m.query(`UPDATE partners SET user_id = $2 WHERE id = $1`, [p.id, dto.userId ?? null]);
        changes.userId = { from: p.user_id, to: dto.userId ?? null };
      }

      let warning: string | null = null;
      if (dto.isActive === true && (!p.is_active || !held.is_active || !money.is_active)) {
        await m.query(`UPDATE partners SET is_active = true WHERE id = $1`, [p.id]);
        await m.query(`UPDATE accounts SET is_active = true WHERE id = ANY($1::uuid[])`, [[held.id, money.id]]);
        changes.isActive = { from: p.is_active, to: true };
      } else if (dto.isActive === false) {
        // §4b switch-off, as an explicit state machine. "Held by" must be ₹0 in
        // every state: switching off never strands patient/hospital money.
        //   active   + money in/out ≠ 0 → 409 unless confirmed; then partner and
        //                                 "Held by" off, money in/out stays on
        //                                 (settlement-only)
        //   active   + money in/out = 0 → partner and both ledgers off
        //   inactive + money in/out ≠ 0 → already settlement-only: no change,
        //                                 no second confirmation
        //   inactive + money in/out = 0 → close the money in/out ledger (how a
        //                                 settled partner is finished off)
        const bal = await ledgerBalances(m, actor.organisationId, [held.id, money.id]);
        const heldP = bal.get(held.id)!;
        const owedP = -bal.get(money.id)!; // credit-normal: + the hospital owes them
        if (heldP !== 0) {
          throw new BadRequestException(`${name} still holds ${inr(heldP)} of hospital money. Record the handover first.`);
        }
        const outstanding = owedP !== 0;
        if (p.is_active && outstanding && !dto.confirmOutstandingBalance) {
          const what = owedP > 0 ? `The hospital owes ${name} ${inr(owedP)}` : `${name} owes the hospital ${inr(owedP)}`;
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            code: 'PARTNER_OUTSTANDING_BALANCE',
            message: `${what}. This stays in the books and can still be settled after switching ${name} off. Confirm to continue.`,
            owedToPartner: rupees(owedP),
          });
        }
        if (p.is_active) {
          await m.query(`UPDATE partners SET is_active = false WHERE id = $1`, [p.id]);
          changes.isActive = { from: true, to: false };
        }
        if (held.is_active) await m.query(`UPDATE accounts SET is_active = false WHERE id = $1`, [held.id]);
        const moneyActive = outstanding; // settlement-only while a balance remains
        if (money.is_active !== moneyActive) {
          await m.query(`UPDATE accounts SET is_active = $2 WHERE id = $1`, [money.id, moneyActive]);
          changes.moneyLedgerActive = { from: money.is_active, to: moneyActive };
        }
        if (outstanding) warning = `${name} is switched off; ${inr(owedP)} is still outstanding and can be settled.`;
      }
      if (!Object.keys(changes).length) return { id: p.id, changed: false, warning };
      await this.record(m, actor, 'cash_partner', p.id, 'update', null, changes, { name });
      return { id: p.id, changed: true, warning };
    });
  }

  // ── Checks and helpers ─────────────────────────────────────────────────

  private async checkCanSwitchOff(m: EntityManager, organisationId: string, a: any, live: boolean) {
    if (!MONEY_KINDS.includes(a.kind)) return; // expense heads: always allowed
    const bal = (await ledgerBalances(m, organisationId, [a.id])).get(a.id)!;
    if (bal !== 0) {
      throw new BadRequestException(`"${a.name}" still has ${inr(bal)}${bal < 0 ? ' (negative)' : ''}. Move it out before switching it off.`);
    }
    if (a.kind === 'cash' && live) {
      // Lock every cash place so two switch-offs can't leave none.
      const cash: Array<{ id: string; is_active: boolean }> = await m.query(
        `SELECT id, is_active FROM accounts WHERE organisation_id = $1 AND kind = 'cash' ORDER BY id FOR UPDATE`,
        [organisationId],
      );
      if (!cash.some((c) => c.is_active && c.id !== a.id)) {
        throw new BadRequestException('At least one cash place must stay switched on');
      }
    }
  }

  // Custodian: an active member of this organisation who can see the place's
  // branch, by the existing branch-visibility rules (§4a).
  private async checkCustodian(m: EntityManager, organisationId: string, userId: string, branchId: string | null) {
    const [mem] = await m.query(
      `SELECT role FROM organisation_users
        WHERE organisation_id = $1 AND user_id = $2 AND deleted_at IS NULL AND COALESCE(is_active, true)`,
      [organisationId, userId],
    );
    if (!mem) throw new BadRequestException('The person responsible must be a member of this clinic');
    if (!branchId) return;
    const scope = await this.branchVisibility.scopeFor({ userId, role: mem.role, organisationId });
    if (scope.kind === 'branches' && !scope.ids.includes(branchId)) {
      throw new BadRequestException('The person responsible must be able to see this branch');
    }
  }

  private async checkPartnerUser(m: EntityManager, organisationId: string, userId: string, partnerId: string | null) {
    const [mem] = await m.query(
      `SELECT 1 FROM organisation_users
        WHERE organisation_id = $1 AND user_id = $2 AND deleted_at IS NULL AND COALESCE(is_active, true)`,
      [organisationId, userId],
    );
    if (!mem) throw new BadRequestException('The linked login must be a member of this clinic');
    const [other] = await m.query(
      `SELECT name FROM partners WHERE organisation_id = $1 AND user_id = $2 AND deleted_at IS NULL AND ($3::uuid IS NULL OR id <> $3)`,
      [organisationId, userId, partnerId],
    );
    if (other) throw new ConflictException(`That login is already linked to ${other.name}`);
  }

  private async checkBranch(m: EntityManager, organisationId: string, branchId: string) {
    const [b] = await m.query(
      `SELECT 1 FROM branches WHERE id = $1 AND organisation_id = $2 AND deleted_at IS NULL`,
      [branchId, organisationId],
    );
    if (!b) throw new NotFoundException('Branch not found');
  }

  // Dr the new place · Cr Opening balance, dated today; one per place (§6).
  private async postOpening(m: EntityManager, actor: CashActor, accountId: string, paise: number, narration: string) {
    const [ob] = await m.query(
      `SELECT id FROM accounts WHERE organisation_id = $1 AND system_key = 'opening_balance' AND is_active`,
      [actor.organisationId],
    );
    if (!ob) throw new BadRequestException('Set up the cash ledgers first');
    return this.posting.post(m, {
      organisationId: actor.organisationId,
      voucherType: 'journal',
      voucherDate: await organisationBusinessDate(m, actor.organisationId),
      narration,
      sourceType: 'opening',
      sourceId: accountId,
      lines: [
        { accountId, debit: paise / 100 },
        { accountId: ob.id, credit: paise / 100 },
      ],
      createdBy: actor.userId,
      actorRole: actor.role ?? null,
      requireLive: true,
    });
  }

  private async updateLedgerRow(m: EntityManager, id: string, name: string, branchId: string | null, custodian: string | null, active: boolean) {
    await this.insertOrConflict(m, name,
      `UPDATE accounts SET name = $2, branch_id = $3, custodian_user_id = $4, is_active = $5 WHERE id = $1 RETURNING id`,
      [id, name, branchId, custodian, active],
    );
  }

  // Runs a write whose only expected failure is a name clash (unique index)
  // and turns that into a readable 409.
  private async insertOrConflict(m: EntityManager, name: string, sql: string, params: unknown[]): Promise<any[]> {
    try {
      const res = await m.query(sql, params);
      // UPDATE … RETURNING comes back as [rows, count] from TypeORM.
      return Array.isArray(res?.[0]) ? res[0] : res;
    } catch (e: any) {
      if (e?.code === '23505') throw new ConflictException(`The name "${name}" is already used in this clinic's cash set-up`);
      throw e;
    }
  }

  private async members(m: EntityManager, organisationId: string) {
    const rows: Array<{ user_id: string; role: string; name: string | null }> = await m.query(
      `SELECT ou.user_id, ou.role, NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), '') AS name
         FROM organisation_users ou JOIN users u ON u.id = ou.user_id AND u.deleted_at IS NULL
        WHERE ou.organisation_id = $1 AND ou.deleted_at IS NULL AND COALESCE(ou.is_active, true)
        ORDER BY name`,
      [organisationId],
    );
    const out: Array<{ userId: string; name: string | null; role: string; branchIds: string[] | 'all' }> = [];
    for (const r of rows) {
      const scope = await this.branchVisibility.scopeFor({ userId: r.user_id, role: r.role, organisationId });
      out.push({ userId: r.user_id, name: r.name, role: r.role, branchIds: scope.kind === 'all' ? 'all' : scope.ids });
    }
    return out;
  }

  private async record(
    m: EntityManager, actor: CashActor, entityType: string, entityId: string, action: 'create' | 'update',
    branchId: string | null, changes: Record<string, { from: unknown; to: unknown }> | null, metadata: Record<string, unknown>,
  ) {
    await this.audit.record({
      organisationId: actor.organisationId, branchId, orgType: 'CLINIC', entityType, entityId, action,
      severity: 'critical', actorUserId: actor.userId, actorRole: actor.role ?? null, source: 'api',
      changes, metadata,
    }, m);
  }

  private cleanName(raw: string, max = 150): string {
    const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
    if (name.length < 2 || name.length > max) throw new BadRequestException(`Name must be 2–${max} characters`);
    return name;
  }

  private assertRole(actor: CashActor, roles: string[]) {
    if (actor.organisationType !== 'CLINIC' || !actor.organisationId) {
      throw new ForbiddenException('Cash tracking is only available to clinics');
    }
    if (!roles.includes(actor.role ?? '')) {
      throw new ForbiddenException(
        roles === WRITE_ROLES
          ? 'Only the owner or an admin can change the cash set-up'
          : 'Cash set-up is only available to the owner, an admin or a manager',
      );
    }
  }

  private async assertEnabled(m: EntityManager, organisationId: string): Promise<{ enabled: boolean; live_from: string | null }> {
    const [s] = await m.query(
      `SELECT cash_module_enabled AS enabled, to_char(cash_module_live_from, 'YYYY-MM-DD') AS live_from
         FROM organisation_settings WHERE organisation_id = $1`,
      [organisationId],
    );
    if (!s?.enabled) throw new ForbiddenException(NOT_ENABLED);
    return s;
  }
}
