import { CostPaymentPostingService } from './cost-payment-posting.service';
import { expenseLedgerKey } from './cash-ledgers.service';

// Hospital cost payments → Payment Vouchers (Cash MVP §5 R6/R7). The real
// database path is the staging end-to-end run.
describe('CostPaymentPostingService', () => {
  const posted: any[] = [];
  const posting = { liveFrom: jest.fn(() => Promise.resolve('2026-09-01' as string | null)), post: jest.fn((_m: any, x: any) => { posted.push(x); return Promise.resolve({ id: 'v' }); }) };
  const ledgers = { checkReceivingAccount: jest.fn(() => Promise.resolve()) };
  const manager: any = { query: jest.fn((sql: string) => Promise.resolve(sql.includes('timezone') ? [{ timezone: 'Asia/Kolkata' }] : sql.includes('system_key = $2') ? [{ id: 'exp-util' }] : [])) };
  const svc = new CostPaymentPostingService(posting as any, ledgers as any);
  const base = { organisationId: 'o', sourceType: 'bill_payment' as const, sourceId: 'bp1', paidOn: '2026-09-24', amount: '5000.00', category: 'Utilities', paidFromAccountId: 'bank', branchId: 'br', narration: 'Paid rent' };
  beforeEach(() => { posted.length = 0; jest.useFakeTimers({ now: new Date('2026-09-24T06:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] }); });
  afterEach(() => jest.useRealTimers());

  it('maps categories to expense ledgers, unknown → Other', () => {
    expect(expenseLedgerKey('Utilities')).toBe('expense_utilities');
    expect(expenseLedgerKey('maintenance')).toBe('expense_maintenance');
    expect(expenseLedgerKey('Rent')).toBe('expense_other');
    expect(expenseLedgerKey(null)).toBe('expense_other');
  });

  it('posts Dr expense / Cr paid-from, dated today, sourced from the payment; paid-from must be hospital cash/bank/UPI', async () => {
    await svc.post(manager, base, { userId: 'u' });
    expect(ledgers.checkReceivingAccount).toHaveBeenLastCalledWith(manager, 'o', 'bank', 'hospital', 'br'); // + the record's branch (G7)
    expect(posted[0]).toMatchObject({ voucherType: 'payment', voucherDate: '2026-09-24', originalDate: null, sourceType: 'bill_payment', sourceId: 'bp1',
      lines: [{ accountId: 'exp-util', debit: 5000, branchId: 'br' }, { accountId: 'bank', credit: 5000, branchId: 'br' }] });
  });

  it('a backdated payment keeps its real day as the original date', async () => {
    await svc.post(manager, { ...base, paidOn: '2026-09-20' }, { userId: 'u' });
    expect(posted[0]).toMatchObject({ voucherDate: '2026-09-24', originalDate: '2026-09-20' });
  });

  it('refuses a future date and a missing paid-from once live', async () => {
    await expect(svc.post(manager, { ...base, paidOn: '2026-09-25' }, { userId: 'u' })).rejects.toThrow('in the future');
    await expect(svc.post(manager, { ...base, paidFromAccountId: null }, { userId: 'u' })).rejects.toThrow('Choose which');
  });

  it('posts nothing while off, before go-live, or for a zero amount', async () => {
    posting.liveFrom.mockResolvedValueOnce(null);
    await expect(svc.post(manager, base, { userId: 'u' })).resolves.toBeNull();
    await expect(svc.post(manager, { ...base, paidOn: '2026-08-31' }, { userId: 'u' })).resolves.toBeNull();
    await expect(svc.post(manager, { ...base, amount: 0 }, { userId: 'u' })).resolves.toBeNull();
    expect(posted).toHaveLength(0);
  });
});
