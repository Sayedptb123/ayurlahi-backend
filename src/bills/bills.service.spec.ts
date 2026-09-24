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
  const setup = (failOn?: unknown, lockedDue = bill.nextDueDate) => {
    const saved: unknown[] = [];
    const manager: any = {
      query: jest.fn(() => Promise.resolve([{ timezone: 'Asia/Kolkata' }])),
      getRepository: jest.fn((entity: unknown) => ({
        create: (x: any) => x,
        findOne: jest.fn(() => Promise.resolve({ ...bill, nextDueDate: lockedDue })),
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
    const service = new BillsService(billRepo, outside, outside, outside, { sendToUsers: jest.fn(() => Promise.resolve()) } as any);
    jest.spyOn(service as any, 'getBranchLabel').mockResolvedValue('');
    const notify = jest.spyOn(service as any, 'notifyOrg').mockImplementation(() => undefined);
    return { service, saved, billRepo, outside, notify };
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
