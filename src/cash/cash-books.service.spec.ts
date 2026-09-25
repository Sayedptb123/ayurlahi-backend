import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CashBooksService } from './cash-books.service';

// Gating, validation and the running-balance maths. Balances against real
// vouchers are checked by the staging read-only run.
describe('CashBooksService', () => {
  const who = (role: string, organisationType = 'CLINIC') => ({ userId: 'u', organisationId: 'org', organisationType, role });
  const LEDGER = '11111111-1111-4111-8111-111111111111';

  // Routes each SQL statement to a canned answer by a fragment of its text.
  // An answer can depend on the parameters (e.g. opening vs closing balance).
  const svcWith = (answers: Array<[RegExp, any[] | ((params: any[]) => any[])]>) => {
    const query = jest.fn((sql: string, params: any[] = []) => {
      const hit = answers.find(([re]) => re.test(sql));
      const a = hit?.[1];
      return Promise.resolve(typeof a === 'function' ? a(params) : a ?? []);
    });
    return { svc: new CashBooksService({ manager: { query } } as any), query };
  };
  const live = (liveFrom: string | null) => [/cash_module_live_from/, [{ live_from: liveFrom }]] as [RegExp, any[]];
  const tz: [RegExp, any[]] = [/SELECT timezone/, [{ timezone: 'Asia/Kolkata' }]];

  it.each(['RECEPTIONIST', 'NURSE', 'STAFF', 'DOCTOR'])('%s cannot read the books', async (role) => {
    const { svc, query } = svcWith([]);
    await expect(svc.today(who(role))).rejects.toThrow(ForbiddenException);
    await expect(svc.dayBook(who(role))).rejects.toThrow(ForbiddenException);
    await expect(svc.ledgerBook(who(role), LEDGER)).rejects.toThrow(ForbiddenException);
    await expect(svc.voucher(who(role), LEDGER)).rejects.toThrow(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });

  it('non-clinic organisations are refused, with no logout-trigger words', async () => {
    const { svc } = svcWith([]);
    const e = await svc.today(who('OWNER', 'MANUFACTURER')).catch((x) => x);
    expect(e).toBeInstanceOf(ForbiddenException);
    const e2 = await svc.today(who('NURSE')).catch((x) => x);
    expect(`${e.message} ${e2.message}`).not.toMatch(/deactivat|account|revoked/i);
  });

  it('not live: says so instead of failing', async () => {
    const { svc } = svcWith([tz, live(null)]);
    await expect(svc.today(who('MANAGER'), '2026-09-25')).resolves.toEqual({ live: false, date: '2026-09-25' });
    await expect(svc.dayBook(who('OWNER'), '2026-09-25')).resolves.toMatchObject({ live: false, vouchers: [] });
  });

  it.each(['2026-9-25', '2026-02-30', 'yesterday'])('rejects bad date %s', async (d) => {
    const { svc } = svcWith([tz, live('2026-09-01')]);
    await expect(svc.today(who('OWNER'), d)).rejects.toThrow(BadRequestException);
  });

  it('rejects an unknown voucher type and a non-uuid branch', async () => {
    const { svc } = svcWith([tz, live('2026-09-01')]);
    await expect(svc.dayBook(who('OWNER'), '2026-09-25', undefined, 'invoice')).rejects.toThrow(BadRequestException);
    await expect(svc.today(who('OWNER'), '2026-09-25', "x' OR 1=1")).rejects.toThrow(BadRequestException);
  });

  it('today: ledger figures and headline totals come back in rupees', async () => {
    const { svc } = svcWith([
      tz, live('2026-09-01'),
      [/AS day_in/, [{ id: 'a1', name: 'Cash drawer', kind: 'cash', branch_id: null, is_active: true, day_in: '1550000', day_out: '172000' }]],
      // shared ledgerBalances: $3 = before (opening), $4 = upTo (closing)
      [/GROUP BY l.account_id/, (p) => [{ account_id: 'a1', p: p[2] ? '2000000' : '3378000' }]],
      [/AS received/, [{ received: '1550000', paid_out: '172000' }]],
      [/GROUP BY v.voucher_type/, [{ voucher_type: 'receipt', n: 3 }]],
      [/patient_advances/, [{ held: '500000' }]],
    ]);
    const r: any = await svc.today(who('OWNER'), '2026-09-25');
    expect(r.ledgers[0]).toMatchObject({ opening: '20000.00', in: '15500.00', out: '1720.00', closing: '33780.00' });
    expect(r).toMatchObject({ received: '15500.00', paidOut: '1720.00', patientAdvancesHeld: '5000.00' });
    expect(r.voucherCounts).toEqual({ receipt: 3, payment: 0, contra: 0, journal: 0 });
    expect(r.closingBy.cash).toBe('33780.00');
  });

  it('ledger book: running balance starts from the opening balance', async () => {
    const { svc } = svcWith([
      tz, live('2026-09-01'),
      [/SELECT id, name, kind, branch_id, is_active FROM accounts/, [{ id: LEDGER, name: 'Cash drawer', kind: 'cash', branch_id: null, is_active: true }]],
      [/GROUP BY l.account_id/, [{ account_id: LEDGER, p: '2000000' }]],
      [/l.description,/, [
        { voucher_id: 'v1', voucher_type: 'receipt', voucher_number: 1, fy_start_year: 2026, voucher_date: '2026-09-25', narration: 'Payment for bill', source_type: 'patient_payment', description: null, debit: '1500000', credit: '0' },
        { voucher_id: 'v2', voucher_type: 'payment', voucher_number: 1, fy_start_year: 2026, voucher_date: '2026-09-25', narration: 'Refund', source_type: 'booking_refund', description: null, debit: '0', credit: '120000' },
      ]],
    ]);
    const r: any = await svc.ledgerBook(who('MANAGER'), LEDGER, '2026-09-01', '2026-09-25');
    expect(r.opening).toBe('20000.00');
    expect(r.rows.map((x: any) => x.balance)).toEqual(['35000.00', '33800.00']);
    expect(r.rows[0].displayNumber).toBe('RV/2026-27/000001');
    expect(r.closing).toBe('33800.00');
  });

  it('ledger book: only balance ledgers of this organisation, and a bounded range', async () => {
    const income = svcWith([tz, live('2026-09-01'), [/FROM accounts WHERE id/, [{ id: LEDGER, name: 'Consultation', kind: 'income' }]]]);
    await expect(income.svc.ledgerBook(who('OWNER'), LEDGER)).rejects.toThrow(NotFoundException);
    const other = svcWith([tz, live('2026-09-01')]);
    await expect(other.svc.ledgerBook(who('OWNER'), LEDGER)).rejects.toThrow(NotFoundException);
    await expect(other.svc.ledgerBook(who('OWNER'), 'not-a-uuid')).rejects.toThrow(NotFoundException);
    const cash = svcWith([tz, live('2026-09-01'), [/FROM accounts WHERE id/, [{ id: LEDGER, name: 'Cash', kind: 'cash' }]]]);
    await expect(cash.svc.ledgerBook(who('OWNER'), LEDGER, '2024-01-01', '2026-09-25')).rejects.toThrow(BadRequestException);
    await expect(cash.svc.ledgerBook(who('OWNER'), LEDGER, '2026-09-26', '2026-09-25')).rejects.toThrow(BadRequestException);
  });

  it('every query is scoped to the caller organisation', async () => {
    const { svc, query } = svcWith([tz, live('2026-09-01')]);
    await svc.today(who('OWNER'), '2026-09-25');
    await svc.dayBook(who('OWNER'), '2026-09-25');
    for (const [sql, params] of query.mock.calls as any[]) {
      expect(sql).toMatch(/organisation_id = \$1/);
      expect(params[0]).toBe('org');
    }
  });

  it('a switched-off place is listed only while it still holds money', async () => {
    const { svc } = svcWith([
      tz, live('2026-09-01'),
      [/AS day_in/, [
        { id: 'a1', name: 'Old drawer', kind: 'cash', branch_id: null, is_active: false, day_in: '0', day_out: '0' },
        { id: 'a2', name: 'Old bank', kind: 'bank', branch_id: null, is_active: false, day_in: '0', day_out: '0' },
      ]],
      [/GROUP BY l.account_id/, [{ account_id: 'a2', p: '50000' }]],
    ]);
    const r: any = await svc.today(who('OWNER'), '2026-09-25');
    expect(r.ledgers.map((l: any) => l.name)).toEqual(['Old bank']);
  });
});
