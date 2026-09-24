import { BillsService } from './bills.service';
import { Expense } from '../expenses/entities/expense.entity';
import { BillPayment } from './entities/bill-payment.entity';
import { RecurringBill } from './entities/recurring-bill.entity';

// Cash MVP plan §6: a recurring-bill payment's expense, payment row and
// due-date advance commit together; this is where its voucher will post.
describe('BillsService — recurring-bill writes are atomic', () => {
  const bill = {
    id: 'rb-1', organisationId: 'org-1', billName: 'Rent', category: 'utilities', branchId: null,
    nextDueDate: '2026-09-24', frequency: 'monthly', dayOfMonth: 24, dayOfWeek: null,
    autoCreateExpense: true, autoApprove: true, approvalThreshold: null, autoPay: true,
    estimatedAmount: '5000', paymentMethod: 'bank_transfer', createdBy: 'u-1',
  };
  const setup = (failOn?: unknown, lockedDue = bill.nextDueDate, opts: { live?: string | null; prior?: any } = {}) => {
    const saved: unknown[] = [];
    const manager: any = {
      query: jest.fn(() => Promise.resolve([{ timezone: 'Asia/Kolkata' }])),
      getRepository: jest.fn((entity: unknown) => ({
        create: (x: any) => x,
        findOne: jest.fn((q: any) => Promise.resolve(q?.where?.idempotencyKey ? opts.prior ?? null : { ...bill, nextDueDate: lockedDue })),
        save: jest.fn((x: any) => {
          if (entity === failOn) return Promise.reject(new Error('save failed'));
          saved.push(entity);
          return Promise.resolve({ ...x, id: 'id-' + saved.length });
        }),
      })),
    };
    const billRepo: any = {
      createQueryBuilder: () => {
        const qb: any = { where: () => qb, andWhere: () => qb, getMany: () => Promise.resolve([{ ...bill }]) };
        return qb;
      },
      findOne: jest.fn(() => Promise.resolve({ ...bill })),
      save: jest.fn(),
      manager: { transaction: jest.fn((cb: any) => cb(manager)) },
    };
    const outside: any = { save: jest.fn(), create: (x: any) => x, find: jest.fn(() => Promise.resolve([])) };
    const costPosting = {
      liveFrom: jest.fn(() => Promise.resolve(opts.live ?? null)),
      checkPaidFrom: jest.fn(() => Promise.resolve()),
      post: jest.fn(() => Promise.resolve(null)),
    };
    const service = new BillsService(billRepo, outside, outside, outside, { sendToUsers: jest.fn(() => Promise.resolve()) } as any, costPosting as any);
    jest.spyOn(service as any, 'getBranchLabel').mockResolvedValue('');
    const notify = jest.spyOn(service as any, 'notifyOrg').mockImplementation(() => undefined);
    const savedRows: any[] = [];
    manager.getRepository.mockImplementation((entity: unknown) => ({
      create: (x: any) => x,
      findOne: jest.fn((q: any) => Promise.resolve(q?.where?.idempotencyKey ? opts.prior ?? null : { ...bill, nextDueDate: lockedDue })),
      save: jest.fn((x: any) => {
        if (entity === failOn) return Promise.reject(new Error('save failed'));
        saved.push(entity); savedRows.push({ entity, x });
        return Promise.resolve({ ...x, id: 'id-' + saved.length });
      }),
    }));
    return { service, saved, savedRows, billRepo, outside, notify, costPosting };
  };

  it('auto-pay run: expense, payment and due-date advance in one transaction, notify after commit', async () => {
    const { service, saved, billRepo, outside, notify } = setup();
    const res = await (service as any).processDueBillsInternal('org-1');
    expect(res).toEqual({ processed: 1 });
    expect(billRepo.manager.transaction).toHaveBeenCalledTimes(1);
    expect(saved).toEqual([Expense, BillPayment, RecurringBill]);
    expect(outside.save).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('a failed due-date advance rolls the run back and sends no notification', async () => {
    const { service, notify } = setup(RecurringBill);
    const res = await (service as any).processDueBillsInternal('org-1');
    expect(res).toEqual({ processed: 0 });
    expect(notify).not.toHaveBeenCalled();
  });

  it('skips a bill another run already advanced', async () => {
    const { service, saved } = setup(undefined, '2026-10-24');
    const res = await (service as any).processDueBillsInternal('org-1');
    expect(res).toEqual({ processed: 0 });
    expect(saved).toEqual([]);
  });

  it('logPayment: expense, payment and due-date advance in one transaction', async () => {
    const { service, saved, billRepo } = setup();
    await service.logPayment('rb-1', { paidAmount: 5000, billAmount: 5000, paidDate: '2026-09-24' } as any, { userId: 'u-1', organisationId: 'org-1' });
    expect(billRepo.manager.transaction).toHaveBeenCalledTimes(1);
    expect(saved).toEqual([Expense, BillPayment, RecurringBill]);
  });
});

describe('BillsService — cash posting (Cash MVP §5 R6)', () => {
  const bill = {
    id: 'rb-1', organisationId: 'org-1', billName: 'Rent', category: 'utilities', branchId: 'br-1',
    nextDueDate: '2026-09-24', frequency: 'monthly', dayOfMonth: 24, dayOfWeek: null,
    autoCreateExpense: true, autoApprove: true, approvalThreshold: null, autoPay: true,
    estimatedAmount: '5000', paymentMethod: 'bank_transfer', createdBy: 'u-1',
  };
  const make = (opts: { live?: string | null; prior?: any } = {}) => {
    const saved: any[] = [];
    const manager: any = {
      query: jest.fn(() => Promise.resolve([{ timezone: 'Asia/Kolkata' }])),
      getRepository: jest.fn((entity: unknown) => ({
        create: (x: any) => x,
        findOne: jest.fn((q: any) => Promise.resolve(q?.where?.idempotencyKey ? opts.prior ?? null : { ...bill })),
        save: jest.fn((x: any) => { saved.push({ entity, x }); return Promise.resolve({ ...x, id: 'id-' + saved.length }); }),
      })),
    };
    const billRepo: any = {
      createQueryBuilder: () => { const qb: any = { where: () => qb, andWhere: () => qb, getMany: () => Promise.resolve([{ ...bill }]) }; return qb; },
      findOne: jest.fn(() => Promise.resolve({ ...bill })),
      manager: { transaction: jest.fn((cb: any) => cb(manager)) },
    };
    const outside: any = { save: jest.fn(), create: (x: any) => x, find: jest.fn(() => Promise.resolve([])) };
    const costPosting = { liveFrom: jest.fn(() => Promise.resolve(opts.live ?? null)), checkPaidFrom: jest.fn(() => Promise.resolve()), post: jest.fn(() => Promise.resolve({ id: 'v' })) };
    const service = new BillsService(billRepo, outside, outside, outside, { sendToUsers: jest.fn(() => Promise.resolve()) } as any, costPosting as any);
    jest.spyOn(service as any, 'getBranchLabel').mockResolvedValue('');
    const notify = jest.spyOn(service as any, 'notifyOrg').mockImplementation(() => undefined);
    return { service, saved, costPosting, notify };
  };
  const dto: any = { paidAmount: 5000, billAmount: 5000, paidDate: '2026-09-24', paidFromAccountId: 'bank', idempotencyKey: 'k1' };

  it('a recorded payment posts one Payment Voucher sourced from the bill_payment row', async () => {
    const { service, costPosting, saved } = make({ live: '2026-09-01' });
    await service.logPayment('rb-1', dto, { userId: 'u-1', organisationId: 'org-1', role: 'OWNER' });
    const payment = saved.find((r) => r.entity === BillPayment);
    expect(costPosting.post).toHaveBeenCalledTimes(1);
    expect((costPosting.post.mock.calls[0] as any[])[1]).toMatchObject({
      sourceType: 'bill_payment', sourceId: 'id-2', paidOn: '2026-09-24', amount: 5000, category: 'utilities', paidFromAccountId: 'bank', branchId: 'br-1',
    });
    expect(payment.x.idempotencyKey).toBe('k1');
    expect(saved.find((r) => r.entity === Expense).x.postedVia).toBe('bill_payment');
  });

  it('the same submit again returns the recorded payment: no expense, no voucher', async () => {
    const { service, costPosting, saved } = make({ live: '2026-09-01', prior: { id: 'bp-1' } });
    await expect(service.logPayment('rb-1', dto, { userId: 'u-1', organisationId: 'org-1' })).resolves.toEqual({ id: 'bp-1' });
    expect(saved).toEqual([]);
    expect(costPosting.post).not.toHaveBeenCalled();
  });

  it('a bill falling due never posts; once live, auto-pay records no payment', async () => {
    const { service, costPosting, saved, notify } = make({ live: '2026-09-01' });
    await (service as any).processDueBillsInternal('org-1');
    expect(costPosting.post).not.toHaveBeenCalled();
    expect(saved.map((r) => r.entity)).toEqual([Expense, RecurringBill]);
    expect(saved[0].x.postedVia).toBe('bill_payment');
    expect((notify.mock.calls[0] as any[])[2]).toMatch(/Record the payment when it is made/);
  });

  it('before go-live, auto-pay still records the payment as before (and posts nothing)', async () => {
    const { service, costPosting, saved } = make({ live: null });
    await (service as any).processDueBillsInternal('org-1');
    expect(saved.map((r) => r.entity)).toEqual([Expense, BillPayment, RecurringBill]);
    expect(costPosting.post).not.toHaveBeenCalled();
  });
});
