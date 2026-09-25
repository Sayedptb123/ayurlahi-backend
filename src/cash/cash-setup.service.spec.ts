import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CashSetupService } from './cash-setup.service';

// Rules from scope/Cash_Setup_Implementation_2026-09-25.md §4. The full flow
// against a real database is covered by the staging end-to-end run.
describe('CashSetupService', () => {
  const who = (role: string, organisationType = 'CLINIC') => ({ userId: 'u-owner', organisationId: 'org', organisationType, role });
  const ID = '11111111-1111-4111-8111-111111111111';
  const BR_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const BR_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  type Answer = any[] | ((params: any[], sql: string) => any);
  // Routes each SQL statement to an answer by a fragment of its text; records writes.
  const build = (answers: Array<[RegExp, Answer]>, opts: { enabled?: boolean; live?: string | null; scope?: any } = {}) => {
    const writes: Array<{ sql: string; params: any[] }> = [];
    const query = jest.fn(async (sql: string, params: any[] = []) => {
      if (/^\s*(INSERT|UPDATE)/.test(sql)) writes.push({ sql, params });
      if (/cash_module_enabled AS enabled/.test(sql)) return [{ enabled: opts.enabled ?? true, live_from: opts.live === undefined ? '2026-09-01' : opts.live }];
      if (/SELECT timezone/.test(sql)) return [{ timezone: 'Asia/Kolkata' }];
      const hit = answers.find(([re]) => re.test(sql));
      const a = hit?.[1];
      const r = typeof a === 'function' ? a(params, sql) : a;
      if (r instanceof Error) throw r;
      return r ?? [];
    });
    const m = { query };
    const posting = { post: jest.fn(async () => ({ displayNumber: 'JV/2026-27/000009' })) };
    const branchVisibility = { scopeFor: jest.fn(async () => opts.scope ?? { kind: 'all' }) };
    const audit = { record: jest.fn(async () => undefined) };
    const svc = new CashSetupService(
      { manager: m, transaction: (cb: any) => cb(m) } as any,
      posting as any, branchVisibility as any, audit as any,
    );
    return { svc, query, writes, posting, branchVisibility, audit };
  };
  const balances = (map: Record<string, number>) =>
    [/GROUP BY l.account_id/, (p: any[]) => (p[1] as string[]).filter((id) => map[id] !== undefined).map((id) => ({ account_id: id, p: String(map[id]) }))] as [RegExp, Answer];
  const logoutWords = /deactivat|account|revoked/i;

  describe('who can do what', () => {
    it.each(['RECEPTIONIST', 'NURSE', 'DOCTOR'])('%s gets nothing', async (role) => {
      const { svc, query } = build([]);
      await expect(svc.getSetup(who(role))).rejects.toThrow(ForbiddenException);
      await expect(svc.createLedger(who(role), { kind: 'bank', name: 'SBI' })).rejects.toThrow(ForbiddenException);
      expect(query).not.toHaveBeenCalled();
    });

    it('a manager can read, without the member list, and cannot change anything', async () => {
      const { svc, writes } = build([]);
      const r = await svc.getSetup(who('MANAGER'));
      expect(r.canEdit).toBe(false);
      expect(r.members).toBeUndefined();
      for (const call of [
        () => svc.createLedger(who('MANAGER'), { kind: 'bank', name: 'SBI' }),
        () => svc.updateLedger(who('MANAGER'), ID, { name: 'X' }),
        () => svc.createPartner(who('MANAGER'), { name: 'Partner A' }),
        () => svc.updatePartner(who('MANAGER'), ID, { isActive: false }),
      ]) {
        const e = await call().catch((x) => x);
        expect(e).toBeInstanceOf(ForbiddenException);
        expect(e.message).not.toMatch(logoutWords);
      }
      expect(writes).toHaveLength(0);
    });

    it('owner gets the member list with the branches each person can see', async () => {
      const { svc } = build([[/FROM organisation_users ou/, [{ user_id: 'u1', role: 'RECEPTIONIST', name: 'Reena' }]]], { scope: { kind: 'branches', ids: [BR_A] } });
      const r = await svc.getSetup(who('OWNER'));
      expect(r.members).toEqual([{ userId: 'u1', name: 'Reena', role: 'RECEPTIONIST', branchIds: [BR_A] }]);
    });

    it('manufacturers and clinics without cash enabled are refused', async () => {
      await expect(build([]).svc.getSetup(who('OWNER', 'MANUFACTURER'))).rejects.toThrow(ForbiddenException);
      const off = build([], { enabled: false });
      await expect(off.svc.getSetup(who('OWNER'))).rejects.toThrow(ForbiddenException);
      await expect(off.svc.createLedger(who('OWNER'), { kind: 'bank', name: 'SBI' })).rejects.toThrow(ForbiddenException);
      expect(off.writes).toHaveLength(0);
    });
  });

  describe('money places', () => {
    it('adds a bank place and audits it', async () => {
      const { svc, writes, audit } = build([[/INSERT INTO accounts/, [{ id: ID }]]]);
      await svc.createLedger(who('ADMIN'), { kind: 'bank', name: '  HDFC   ••4521 ' });
      expect(writes[0].params.slice(1, 4)).toEqual([null, 'bank', 'HDFC ••4521']);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'cash_ledger', action: 'create', entityId: ID }), expect.anything());
    });

    it('a name clash is a readable 409', async () => {
      const { svc } = build([[/INSERT INTO accounts/, () => Object.assign(new Error('dup'), { code: '23505' })]]);
      const e = await svc.createLedger(who('OWNER'), { kind: 'upi', name: 'UPI' }).catch((x) => x);
      expect(e).toBeInstanceOf(ConflictException);
      expect(e.message).toMatch(/"UPI" is already used/);
    });

    it('expense heads have no branch, custodian or opening balance', async () => {
      const { svc } = build([]);
      await expect(svc.createLedger(who('OWNER'), { kind: 'expense', name: 'Food', branchId: BR_A })).rejects.toThrow(BadRequestException);
      await expect(svc.createLedger(who('OWNER'), { kind: 'bank', name: 'SBI', custodianUserId: ID })).rejects.toThrow(BadRequestException);
      await expect(svc.createLedger(who('OWNER'), { kind: 'expense', name: 'Food', openingBalance: 10 })).rejects.toThrow(BadRequestException);
    });

    it('a branch of another organisation is not found', async () => {
      const { svc } = build([[/FROM branches WHERE id/, []]]);
      await expect(svc.createLedger(who('OWNER'), { kind: 'cash', name: 'Drawer', branchId: BR_A })).rejects.toThrow(NotFoundException);
    });

    describe('custodian must be a member who can see the branch', () => {
      const member = [/SELECT role FROM organisation_users/, [{ role: 'RECEPTIONIST' }]] as [RegExp, Answer];
      const branchOk = [/FROM branches WHERE id/, [{ '?column?': 1 }]] as [RegExp, Answer];
      const add = [/INSERT INTO accounts/, [{ id: ID }]] as [RegExp, Answer];

      it('not a member → refused', async () => {
        const { svc } = build([[/SELECT role FROM organisation_users/, []], branchOk]);
        await expect(svc.createLedger(who('OWNER'), { kind: 'cash', name: 'Drawer B', branchId: BR_B, custodianUserId: ID })).rejects.toThrow(/member of this clinic/);
      });
      it('Branch-A-only user → refused for Branch B', async () => {
        const { svc, writes } = build([member, branchOk, add], { scope: { kind: 'branches', ids: [BR_A] } });
        await expect(svc.createLedger(who('OWNER'), { kind: 'cash', name: 'Drawer B', branchId: BR_B, custodianUserId: ID })).rejects.toThrow(/able to see this branch/);
        expect(writes).toHaveLength(0);
      });
      it('user who sees A and B → allowed for B', async () => {
        const { svc, writes } = build([member, branchOk, add], { scope: { kind: 'branches', ids: [BR_A, BR_B] } });
        await svc.createLedger(who('OWNER'), { kind: 'cash', name: 'Drawer B', branchId: BR_B, custodianUserId: ID });
        expect(writes).toHaveLength(1);
      });
      it('organisation-wide place → membership is enough (branch visibility not consulted)', async () => {
        const { svc, branchVisibility } = build([member, add], { scope: { kind: 'branches', ids: [] } });
        await svc.createLedger(who('OWNER'), { kind: 'cash', name: 'Main safe', custodianUserId: ID });
        expect(branchVisibility.scopeFor).not.toHaveBeenCalled();
      });
      it('moving a place to a branch its custodian cannot see → refused', async () => {
        const { svc } = build([
          [/FOR UPDATE/, [{ id: ID, kind: 'cash', name: 'Drawer', branch_id: null, custodian_user_id: 'u9', is_active: true }]],
          [/SELECT DISTINCT account_id/, []], member, branchOk,
        ], { scope: { kind: 'branches', ids: [BR_A] } });
        await expect(svc.updateLedger(who('OWNER'), ID, { branchId: BR_B })).rejects.toThrow(/able to see this branch/);
      });
    });

    it('opening balance: refused before go-live; after go-live posts a journal for that place', async () => {
      const before = build([[/INSERT INTO accounts/, [{ id: ID }]]], { live: null });
      await expect(before.svc.createLedger(who('OWNER'), { kind: 'bank', name: 'SBI', openingBalance: 2000 })).rejects.toThrow(/go-live step/);
      expect(before.writes).toHaveLength(0);

      const after = build([[/INSERT INTO accounts/, [{ id: ID }]], [/system_key = 'opening_balance'/, [{ id: 'ob' }]]]);
      const r = await after.svc.createLedger(who('OWNER'), { kind: 'bank', name: 'SBI', openingBalance: 2000.5 });
      expect(after.posting.post).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        voucherType: 'journal', sourceType: 'opening', sourceId: ID, requireLive: true,
        lines: [{ accountId: ID, debit: 2000.5 }, { accountId: 'ob', credit: 2000.5 }],
      }));
      expect(r.openingVoucher).toBe('JV/2026-27/000009');
    });

    const place = (over: any = {}) => [/FOR UPDATE/, (p: any[], sql: string) =>
      /kind = 'cash' ORDER BY id/.test(sql) ? over.cash ?? [] : [{ id: ID, kind: 'cash', name: 'Cash drawer – Main', branch_id: BR_A, custodian_user_id: null, is_active: true, ...over.row }]] as [RegExp, Answer];

    it('rename keeps the identity: only the name changes, audited old → new', async () => {
      const { svc, writes, audit } = build([place({ row: { kind: 'bank', name: 'Bank', branch_id: null } })]);
      await svc.updateLedger(who('OWNER'), ID, { name: 'HDFC ••4521' });
      expect(writes).toHaveLength(1);
      expect(writes[0].sql).toMatch(/UPDATE accounts SET name/);
      expect(writes[0].sql).not.toMatch(/system_key|kind/);
      expect(writes[0].params).toEqual([ID, 'HDFC ••4521', null, null, true]);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ changes: { name: { from: 'Bank', to: 'HDFC ••4521' } } }), expect.anything());
    });

    it('switching off is refused while the place holds money', async () => {
      const { svc, writes } = build([place(), balances({ [ID]: 230000 })]);
      const e = await svc.updateLedger(who('OWNER'), ID, { isActive: false }).catch((x) => x);
      expect(e).toBeInstanceOf(BadRequestException);
      expect(e.message).toMatch(/₹2,300.00.*Move it out/);
      expect(e.message).not.toMatch(logoutWords);
      expect(writes).toHaveLength(0);
    });

    it('the last switched-on cash place cannot be switched off once live', async () => {
      const { svc } = build([place({ cash: [{ id: ID, is_active: true }, { id: 'c2', is_active: false }] }), balances({})]);
      await expect(svc.updateLedger(who('OWNER'), ID, { isActive: false })).rejects.toThrow(/At least one cash place/);
      const ok = build([place({ cash: [{ id: ID, is_active: true }, { id: 'c2', is_active: true }] }), balances({})]);
      await expect(ok.svc.updateLedger(who('OWNER'), ID, { isActive: false })).resolves.toMatchObject({ changed: true });
    });

    it('a place with entries keeps its branch; partner and system ledgers are not edited here', async () => {
      const { svc } = build([place(), [/SELECT DISTINCT account_id/, [{ account_id: ID }]], [/FROM branches WHERE id/, [{}]]]);
      await expect(svc.updateLedger(who('OWNER'), ID, { branchId: BR_B })).rejects.toThrow(/already has entries/);
      const partner = build([place({ row: { kind: 'held_by_partner' } })]);
      await expect(partner.svc.updateLedger(who('OWNER'), ID, { name: 'X' })).rejects.toThrow(/change with the partner/);
      const system = build([place({ row: { kind: 'opening_balance' } })]);
      await expect(system.svc.updateLedger(who('OWNER'), ID, { name: 'X' })).rejects.toThrow(/managed by the system/);
    });
  });

  describe('partners', () => {
    it('adding a partner creates the partner and exactly its two ledgers', async () => {
      const { svc, writes } = build([
        [/INSERT INTO partners/, [{ id: 'p1' }]],
        [/INSERT INTO accounts/, (p: any[]) => [{ id: `acc-${p[1]}` }]],
      ]);
      const r = await svc.createPartner(who('OWNER'), { name: 'Dr Anil' });
      expect(writes.map((w) => w.params[1])).toEqual(['Dr Anil', 'Held by Dr Anil', 'Dr Anil – money in/out']);
      expect(writes[1].sql).toMatch(/'held_by_partner'/);
      expect(writes[2].sql).toMatch(/'partner_unclassified'/);
      expect(r).toMatchObject({ id: 'p1', heldLedgerId: 'acc-Held by Dr Anil' });
    });

    it('if the second ledger fails, the error propagates (the transaction rolls everything back)', async () => {
      let n = 0;
      const { svc } = build([
        [/INSERT INTO partners/, [{ id: 'p1' }]],
        [/INSERT INTO accounts/, () => (++n === 2 ? Object.assign(new Error('dup'), { code: '23505' }) : [{ id: 'a' }])],
      ]);
      await expect(svc.createPartner(who('OWNER'), { name: 'Dr Anil' })).rejects.toThrow(ConflictException);
    });

    it('a login can be linked to only one partner, and must be a member', async () => {
      const notMember = build([[/SELECT 1 FROM organisation_users/, []]]);
      await expect(notMember.svc.createPartner(who('OWNER'), { name: 'Dr A', userId: ID })).rejects.toThrow(BadRequestException);
      const taken = build([[/SELECT 1 FROM organisation_users/, [{}]], [/SELECT name FROM partners/, [{ name: 'Dr Beena' }]]]);
      await expect(taken.svc.createPartner(who('OWNER'), { name: 'Dr A', userId: ID })).rejects.toThrow(/already linked to Dr Beena/);
    });

    const partner = (active = true, moneyActive = true) => [
      [/FROM partners\s+WHERE id = \$1/, [{ id: 'p1', name: 'Dr Anil', user_id: null, is_active: active }]],
      [/partner_id = \$2 ORDER BY id FOR UPDATE/, [{ id: 'held', kind: 'held_by_partner', is_active: active }, { id: 'money', kind: 'partner_unclassified', is_active: moneyActive }]],
    ] as Array<[RegExp, Answer]>;

    it('rename cascades to both ledgers', async () => {
      const { svc, writes } = build([...partner(), [/^\s*UPDATE/, [[{ id: 'x' }], 1]]]);
      await svc.updatePartner(who('OWNER'), 'p1', { name: 'Dr Anil K' });
      expect(writes.map((w) => w.params[1])).toEqual(['Dr Anil K', 'Held by Dr Anil K', 'Dr Anil K – money in/out']);
    });

    it('switch-off is refused while the partner holds money', async () => {
      const { svc, writes } = build([...partner(), balances({ held: 2000000, money: 0 })]);
      const e = await svc.updatePartner(who('OWNER'), 'p1', { isActive: false }).catch((x) => x);
      expect(e).toBeInstanceOf(BadRequestException);
      expect(e.message).toMatch(/still holds ₹20,000.00/);
      expect(writes).toHaveLength(0);
    });

    it('money owed: 409 first, then with confirmation the partner is off and money in/out stays open for settlement', async () => {
      const first = build([...partner(), balances({ held: 0, money: -1500000 })]);
      const e = await first.svc.updatePartner(who('OWNER'), 'p1', { isActive: false }).catch((x) => x);
      expect(e).toBeInstanceOf(ConflictException);
      expect(e.getResponse()).toMatchObject({ code: 'PARTNER_OUTSTANDING_BALANCE', owedToPartner: '15000.00' });
      expect(e.message).toMatch(/owes Dr Anil ₹15,000.00/);
      expect(first.writes).toHaveLength(0);

      const second = build([...partner(), balances({ held: 0, money: -1500000 })]);
      const r = await second.svc.updatePartner(who('OWNER'), 'p1', { isActive: false, confirmOutstandingBalance: true });
      const sqls = second.writes.map((w) => `${w.sql.replace(/\s+/g, ' ')} ${JSON.stringify(w.params)}`);
      expect(sqls.some((s) => /UPDATE partners SET is_active = false/.test(s))).toBe(true);
      expect(sqls.some((s) => /UPDATE accounts SET is_active = false WHERE id = \$1 \["held"\]/.test(s))).toBe(true);
      expect(sqls.some((s) => /\["money"/.test(s))).toBe(false); // money in/out untouched: still active
      expect(r.warning).toMatch(/still outstanding/);
    });

    it('switch-off state machine: active + ₹0 → partner and both ledgers off, no confirmation needed', async () => {
      const { svc, writes } = build([...partner(), balances({ held: 0, money: 0 })]);
      const r = await svc.updatePartner(who('OWNER'), 'p1', { isActive: false });
      const sqls = writes.map((w) => `${w.sql.replace(/\s+/g, ' ')} ${JSON.stringify(w.params)}`);
      expect(sqls.some((s) => /UPDATE partners SET is_active = false/.test(s))).toBe(true);
      expect(sqls.some((s) => /\["held"\]/.test(s))).toBe(true);
      expect(sqls.some((s) => /\["money",false\]/.test(s))).toBe(true);
      expect(r.warning).toBeNull();
    });

    it('switch-off state machine: already settlement-only + still outstanding → no change and no second confirmation', async () => {
      const { svc, writes, audit } = build([...partner(false, true), balances({ held: 0, money: -300000 })]);
      const r = await svc.updatePartner(who('OWNER'), 'p1', { isActive: false });
      expect(writes).toHaveLength(0);
      expect(audit.record).not.toHaveBeenCalled();
      expect(r).toMatchObject({ changed: false });
      expect(r.warning).toMatch(/₹3,000.00 is still outstanding/);
    });

    it('switch-off state machine: a switched-off partner still holding money is refused too', async () => {
      const { svc, writes } = build([...partner(false, true), balances({ held: 50000, money: -300000 })]);
      await expect(svc.updatePartner(who('OWNER'), 'p1', { isActive: false })).rejects.toThrow(/still holds ₹500.00/);
      expect(writes).toHaveLength(0);
    });

    it('a switched-off partner whose money in/out reaches ₹0 can have it closed', async () => {
      const { svc, writes } = build([...partner(false, true), balances({ held: 0, money: 0 })]);
      await svc.updatePartner(who('OWNER'), 'p1', { isActive: false });
      expect(writes.some((w) => /UPDATE accounts SET is_active = \$2/.test(w.sql) && w.params[0] === 'money' && w.params[1] === false)).toBe(true);
    });

    it('switching back on reopens both ledgers', async () => {
      const { svc, writes } = build([...partner(false, false)]);
      await svc.updatePartner(who('OWNER'), 'p1', { isActive: true });
      expect(writes.some((w) => /UPDATE accounts SET is_active = true/.test(w.sql) && JSON.stringify(w.params) === JSON.stringify([['held', 'money']]))).toBe(true);
    });
  });
});
