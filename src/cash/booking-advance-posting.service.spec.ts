import { BookingAdvancePostingService } from './booking-advance-posting.service';

// Voucher shapes for booking advances (Cash MVP §5 R2/R3/R4). The full
// lifecycle on a real database is the staging end-to-end run.
describe('BookingAdvancePostingService', () => {
  const posted: any[] = [];
  const posting = {
    liveFrom: jest.fn(() => Promise.resolve('2026-09-01')),
    post: jest.fn((_m: any, x: any) => { posted.push(x); return Promise.resolve({ id: 'v' }); }),
    reverse: jest.fn(),
  };
  const ledgers = {
    checkReceivingAccount: jest.fn(() => Promise.resolve()),
    incomeShares: jest.fn(() => Promise.resolve([{ accountId: 'inc-room', paise: 150000 }])),
  };
  const manager: any = {
    query: jest.fn((sql: string) =>
      Promise.resolve(sql.includes("system_key = 'patient_advances'") ? [{ id: 'pa' }] : sql.includes('timezone') ? [{ timezone: 'Asia/Kolkata' }] : []),
    ),
  };
  const svc = new BookingAdvancePostingService(posting as any, ledgers as any);
  const actor = { userId: 'u' };
  beforeEach(() => { posted.length = 0; jest.useFakeTimers({ now: new Date('2026-09-24T06:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] }); });
  afterEach(() => jest.useRealTimers());

  it('advance receipt: Dr received-into / Cr Patient advances, sourced from the receipt row', async () => {
    await svc.postReceipt(manager, { id: 'r1', organisationId: 'o', bookingId: 'b', amount: '1500.00', receivedAt: '2026-09-24', paymentMethod: 'cash', receivedIntoAccountId: 'drawer' }, { branchId: 'br' }, actor);
    expect(posted[0]).toMatchObject({ voucherType: 'receipt', sourceType: 'booking_advance', sourceId: 'r1', lines: [{ accountId: 'drawer', debit: 1500 }, { accountId: 'pa', credit: 1500 }] });
  });

  it('check-in transfer is a journal with no cash line', async () => {
    await svc.postTransfer(manager, { organisationId: 'o', admissionId: 'adm', billId: 'bill', branchId: null, amount: 1500 }, actor);
    expect(posted[0]).toMatchObject({ voucherType: 'journal', sourceType: 'advance_transfer', sourceId: 'adm', lines: [{ accountId: 'pa', debit: 1500 }, { accountId: 'inc-room', credit: 1500 }] });
  });

  it('refund: Dr Patient advances / Cr paid-from; bank transfer must come from a bank ledger', async () => {
    await svc.postRefund(manager, { organisationId: 'o', bookingId: 'b', branchId: null, amount: 800, method: 'BANK_TRANSFER', paidFromAccountId: 'bank' }, actor);
    expect(ledgers.checkReceivingAccount).toHaveBeenLastCalledWith(manager, 'o', 'bank', 'bank_transfer', null); // + the record's branch (G7)
    expect(posted[0]).toMatchObject({ voucherType: 'payment', sourceType: 'booking_refund', lines: [{ accountId: 'pa', debit: 800 }, { accountId: 'bank', credit: 800 }] });
  });

  it('refund by "OTHER" is refused once live; a ₹0 refund posts nothing', async () => {
    await expect(svc.postRefund(manager, { organisationId: 'o', bookingId: 'b', branchId: null, amount: 5, method: 'OTHER', paidFromAccountId: 'x' }, actor)).rejects.toThrow("can't be recorded");
    await expect(svc.postRefund(manager, { organisationId: 'o', bookingId: 'b', branchId: null, amount: 0, method: 'CASH' }, actor)).resolves.toBeNull();
    expect(posted).toHaveLength(0);
  });

  it('nothing posts while the module is off', async () => {
    posting.liveFrom.mockResolvedValueOnce(null as any).mockResolvedValueOnce(null as any);
    await expect(svc.postTransfer(manager, { organisationId: 'o', admissionId: 'a', billId: 'b', branchId: null, amount: 10 }, actor)).resolves.toBeNull();
    await expect(svc.postReceipt(manager, { id: 'r', organisationId: 'o', bookingId: 'b', amount: 10, receivedAt: '2026-09-24', paymentMethod: 'cash', receivedIntoAccountId: null }, { branchId: null }, actor)).resolves.toBeNull();
    expect(posted).toHaveLength(0);
  });
});
