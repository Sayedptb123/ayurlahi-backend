import { CashLedgersService } from './cash-ledgers.service';
import { PatientPaymentPostingService } from './patient-payment-posting.service';

// Patient payment → Receipt Voucher rules (Cash MVP plan §5 R1/R5). The real
// database path is covered by the staging end-to-end run.

const LEDGERS = [
  { id: 'inc-consult', system_key: 'income_consultation' },
  { id: 'inc-pharm', system_key: 'income_pharmacy' },
  { id: 'inc-room', system_key: 'income_room_stay' },
  { id: 'inc-other', system_key: 'income_other' },
];

const managerFor = (items: Array<{ item_type: string; total: string }>, account?: any) => ({
  query: jest.fn((sql: string) => {
    if (sql.includes('FROM bill_items')) return Promise.resolve(items);
    if (sql.includes('system_key = ANY')) return Promise.resolve(LEDGERS);
    if (sql.includes('SELECT kind, name, is_active')) return Promise.resolve(account ? [account] : []);
    if (sql.includes('timezone')) return Promise.resolve([{ timezone: 'Asia/Kolkata' }]);
    return Promise.resolve([]);
  }),
});

describe('CashLedgersService.incomeShares', () => {
  const svc = new CashLedgersService();

  it('splits a payment across income ledgers by item totals, exactly to the paisa', async () => {
    const m = managerFor([
      { item_type: 'consultation', total: '500.00' },
      { item_type: 'medicine', total: '250.00' },
      { item_type: 'medicine', total: '250.00' },
    ]);
    const shares = await svc.incomeShares(m as any, 'org-1', 'bill-1', 33333); // ₹333.33
    expect(shares.reduce((s, x) => s + x.paise, 0)).toBe(33333);
    expect(shares).toEqual(expect.arrayContaining([
      { accountId: 'inc-consult', paise: 16667 }, // remainder goes to the largest share
      { accountId: 'inc-pharm', paise: 16666 },
    ]));
  });

  it('maps accommodation to Room & stay and unknown types to Other', async () => {
    const m = managerFor([{ item_type: 'accommodation', total: '1000' }, { item_type: 'mystery', total: '1000' }]);
    const shares = await svc.incomeShares(m as any, 'org-1', 'bill-1', 2000);
    expect(shares).toEqual(expect.arrayContaining([{ accountId: 'inc-room', paise: 1000 }, { accountId: 'inc-other', paise: 1000 }]));
  });

  it('uses Other income when the bill has no priced items', async () => {
    const shares = await svc.incomeShares(managerFor([]) as any, 'org-1', 'bill-1', 500);
    expect(shares).toEqual([{ accountId: 'inc-other', paise: 500 }]);
  });

  it.each([
    ['cash', 'bank', false], ['cash', 'cash', true], ['cash', 'held_by_partner', true],
    ['upi', 'upi', true], ['upi', 'cash', false], ['card', 'bank', true], ['cheque', 'upi', false],
  ])('a %s payment into a %s ledger → allowed: %s', async (method, kind, ok) => {
    const m = managerFor([], { kind, name: 'L', is_active: true });
    const p = svc.checkReceivingAccount(m as any, 'org-1', 'acc', method as string);
    if (ok) await expect(p).resolves.toBeUndefined();
    else await expect(p).rejects.toThrow("can't be received into");
  });

  it('treats another organisation\'s ledger as not found, and rejects inactive ones', async () => {
    await expect(svc.checkReceivingAccount(managerFor([]) as any, 'org-1', 'acc', 'cash')).rejects.toThrow('not found');
    await expect(svc.checkReceivingAccount(managerFor([], { kind: 'cash', name: 'Old', is_active: false }) as any, 'org-1', 'acc', 'cash'))
      .rejects.toThrow('inactive');
  });
});

describe('PatientPaymentPostingService.post', () => {
  const posting = { liveFrom: jest.fn(), post: jest.fn((_m: any, x: any) => Promise.resolve({ id: 'v-1', ...x })), reverse: jest.fn() };
  const svc = new PatientPaymentPostingService(posting as any, new CashLedgersService());
  const payment = { id: 'pay-1', organisationId: 'org-1', billId: 'bill-1', amount: '300.00', paidAt: '2026-09-24', paymentMethod: 'cash', receivedIntoAccountId: 'drawer' };
  const bill = { id: 'bill-1', billNumber: 'BILL-00007', branchId: 'br-1' };
  const actor = { userId: 'u-1', role: 'RECEPTIONIST' };
  const m = managerFor([{ item_type: 'consultation', total: '300' }], { kind: 'cash', name: 'Drawer', is_active: true });

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-09-24T06:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    posting.post.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('does nothing while the module is off, or for a payment dated before go-live', async () => {
    posting.liveFrom.mockResolvedValueOnce(null);
    await expect(svc.post(m as any, payment, bill, actor)).resolves.toBeNull();
    posting.liveFrom.mockResolvedValueOnce('2026-09-25');
    await expect(svc.post(m as any, payment, bill, actor)).resolves.toBeNull();
    expect(posting.post).not.toHaveBeenCalled();
  });

  it('once live, requires where the money was received', async () => {
    posting.liveFrom.mockResolvedValue('2026-09-01');
    await expect(svc.post(m as any, { ...payment, receivedIntoAccountId: null }, bill, actor)).rejects.toThrow('Choose where this payment was received');
  });

  it('rejects a future-dated payment', async () => {
    posting.liveFrom.mockResolvedValue('2026-09-01');
    await expect(svc.post(m as any, { ...payment, paidAt: '2026-09-25' }, bill, actor)).rejects.toThrow('in the future');
  });

  it('posts Dr received-into / Cr income, dated today, sourced from the payment', async () => {
    posting.liveFrom.mockResolvedValue('2026-09-01');
    await svc.post(m as any, payment, bill, actor);
    expect(posting.post.mock.calls[0][1]).toMatchObject({
      voucherType: 'receipt', voucherDate: '2026-09-24', originalDate: null, branchId: 'br-1',
      sourceType: 'patient_payment', sourceId: 'pay-1', createdBy: 'u-1',
      lines: [
        { accountId: 'drawer', debit: 300, branchId: 'br-1' },
        { accountId: 'inc-consult', credit: 300, branchId: 'br-1' },
      ],
    });
  });

  it('a backdated payment is posted today with its real date kept as the original date', async () => {
    posting.liveFrom.mockResolvedValue('2026-09-01');
    await svc.post(m as any, { ...payment, paidAt: '2026-09-20' }, bill, actor);
    expect(posting.post.mock.calls[0][1]).toMatchObject({ voucherDate: '2026-09-24', originalDate: '2026-09-20' });
  });
});
