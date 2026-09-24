import { unrestrictedBranchVisibilityMock } from '../branch-visibility/testing/branch-visibility.mock';
import { ForbiddenException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';

// SEC-7 regression: findAll/getSummary/assertCanAccess (used by findOne) all
// used an if/else-if on CLINIC/MANUFACTURER with a bare comment
// "AYURLAHI_TEAM: no additional filter/restriction" — that comment applied
// to any unmatched organisationType, including undefined, leaking every
// invoice and the platform-wide financial summary to any authenticated user
// whose current-org lookup hadn't resolved.

const makeQueryBuilder = (rows: any[]) => {
  const qb: any = {
    leftJoinAndSelect: jest.fn(() => qb),
    leftJoin: jest.fn(() => qb),
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    skip: jest.fn(() => qb),
    take: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    select: jest.fn(() => qb),
    addSelect: jest.fn(() => qb),
    getCount: jest.fn(() => Promise.resolve(rows.length)),
    getMany: jest.fn(() => Promise.resolve(rows)),
    getRawOne: jest.fn(() =>
      Promise.resolve({
        totalPaid: '0', totalOutstanding: '0', overdueAmount: '0',
        paidCount: '0', pendingCount: '0', overdueCount: '0',
      }),
    ),
  };
  return qb;
};

const makeService = (rows: any[] = []) => {
  const qb = makeQueryBuilder(rows);
  const invoicesRepository = {
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn(() => Promise.resolve(rows[0] ?? null)),
    manager: { getRepository: jest.fn(() => ({ find: jest.fn(() => Promise.resolve([])) })) },
  };
  const orderItemsRepository = { exist: jest.fn(() => Promise.resolve(false)) };
  const service = new InvoicesService(
    invoicesRepository as any,
    {} as any, // ordersRepository
    orderItemsRepository as any,
    {} as any, // usersRepository
    {} as any, // orgUserRepository
    {} as any, // notificationsService
    unrestrictedBranchVisibilityMock(),
  );
  return { service, qb, orderItemsRepository };
};

describe('InvoicesService.findAll — SEC-7 org-scoping', () => {
  const query = {} as any;

  it('AYURLAHI_TEAM caller sees all invoices, unfiltered (unchanged)', async () => {
    const { service, qb } = makeService([{ id: 'i1', order: undefined }]);
    const result = await service.findAll('u1', 'SUPER_ADMIN', query, undefined, 'AYURLAHI_TEAM');
    expect(qb.andWhere).not.toHaveBeenCalled();
    expect(result.data).toHaveLength(1);
  });

  it('undefined organisationType is denied, not treated as AYURLAHI_TEAM', async () => {
    const { service } = makeService([{ id: 'i1' }]);
    const result = await service.findAll('u1', 'OWNER', query, undefined, undefined);
    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });

  it('an unrecognised organisationType is denied', async () => {
    const { service } = makeService([{ id: 'i1' }]);
    const result = await service.findAll('u1', 'OWNER', query, 'org-x', 'SOMETHING_ELSE' as any);
    expect(result.data).toEqual([]);
  });
});

describe('InvoicesService.getSummary — SEC-7 org-scoping', () => {
  it('undefined organisationType gets the zeroed summary, not the platform-wide total', async () => {
    const { service } = makeService();
    const result = await service.getSummary(undefined, undefined);
    expect(result).toMatchObject({ totalOutstanding: 0, totalPaid: 0, overdueAmount: 0 });
  });

  it('AYURLAHI_TEAM gets the aggregated (unfiltered) summary', async () => {
    const { service, qb } = makeService();
    await service.getSummary(undefined, 'AYURLAHI_TEAM');
    expect(qb.andWhere).not.toHaveBeenCalled();
  });
});

describe('InvoicesService.findOne — SEC-7 org-scoping', () => {
  const invoice = { id: 'inv-1', orderId: 'ord-1', order: { organisationId: 'org-clinic' } };

  it('CLINIC caller from the owning org can read the invoice', async () => {
    const { service } = makeService([invoice]);
    await expect(
      service.findOne('inv-1', 'u1', 'OWNER', 'org-clinic', 'CLINIC'),
    ).resolves.toMatchObject({ id: 'inv-1' });
  });

  it('CLINIC caller from a different org is denied', async () => {
    const { service } = makeService([invoice]);
    await expect(
      service.findOne('inv-1', 'u1', 'OWNER', 'org-other', 'CLINIC'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('undefined organisationType is denied, not global', async () => {
    const { service } = makeService([invoice]);
    await expect(
      service.findOne('inv-1', 'u1', 'OWNER', undefined, undefined),
    ).rejects.toThrow(ForbiddenException);
  });
});

// Caught in the 2026-09-13 LIVE acceptance pass for the Post-PACKED Order
// Correction Workflow (not by a unit test): a cancelled invoice
// (isPaid=false, dueDate in the future) still matched the PENDING/OVERDUE
// filter conditions, which checked isPaid/dueDate but not cancelledAt --
// so GET /invoices?status=pending kept returning an invoice whose own
// status field correctly said "cancelled". getSummary already excluded it;
// applyStatusFilter's PENDING/OVERDUE branches didn't.
describe('InvoicesService.findAll — cancelled invoices excluded from PENDING/OVERDUE', () => {
  const query = { status: 'pending' } as any;

  it('PENDING filter excludes a cancelled invoice (isPaid=false, cancelledAt set)', async () => {
    const { service, qb } = makeService([]);
    await service.findAll('u1', 'SUPER_ADMIN', query, undefined, 'AYURLAHI_TEAM');
    expect(qb.andWhere).toHaveBeenCalledWith(
      'invoice."isPaid" = false AND invoice."cancelledAt" IS NULL AND (invoice."dueDate" IS NULL OR invoice."dueDate" >= NOW())',
    );
  });

  it('OVERDUE filter excludes a cancelled invoice the same way', async () => {
    const { service, qb } = makeService([]);
    await service.findAll('u1', 'SUPER_ADMIN', { status: 'overdue' } as any, undefined, 'AYURLAHI_TEAM');
    expect(qb.andWhere).toHaveBeenCalledWith(
      'invoice."isPaid" = false AND invoice."cancelledAt" IS NULL AND invoice."dueDate" < NOW()',
    );
  });
});
