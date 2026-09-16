import { DisputesService } from './disputes.service';

// SEC-7 regression: findAll only applied the org filter when
// `!isAdminOrSupport(userRole) && organisationId` was true — a non-admin
// caller with no resolved organisationId (unresolved current-org lookup)
// skipped the filter entirely and got every dispute across every org.
// This is distinct from T16 (manufacturer under-scoping): T16 is about the
// filter matching the wrong column for a manufacturer; this is about the
// filter not being applied at all.

const makeQueryBuilder = (rows: any[]) => {
  const qb: any = {
    where: jest.fn(() => qb),
    leftJoinAndSelect: jest.fn(() => qb),
    leftJoin: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    skip: jest.fn(() => qb),
    take: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    getManyAndCount: jest.fn(() => Promise.resolve([rows, rows.length])),
  };
  return qb;
};

const makeService = (rows: any[]) => {
  const qb = makeQueryBuilder(rows);
  const disputesRepository = { createQueryBuilder: jest.fn(() => qb) };
  const service = new DisputesService(
    disputesRepository as any,
    {} as any, // usersRepository
    {} as any, // ordersRepository
  );
  return { service, qb };
};

// findAll()'s signature is (userId, userRole, query, organisationType,
// organisationId) — organisationType was added for T16 below; every call in
// this describe block already reflects the new position.
describe('DisputesService.findAll — SEC-7 org-scoping', () => {
  it('admin/support role sees everything, unfiltered (unchanged)', async () => {
    const { service, qb } = makeService([{ id: 'd1' }]);
    const result = await service.findAll('u1', 'SUPER_ADMIN', {} as any, undefined, undefined);
    expect(qb.andWhere).not.toHaveBeenCalled();
    expect(result.data).toHaveLength(1);
  });

  it('non-admin CLINIC caller with a resolved organisationId is scoped to it (unchanged)', async () => {
    const { service, qb } = makeService([]);
    await service.findAll('u1', 'OWNER', {} as any, 'CLINIC', 'org-1');
    expect(qb.andWhere).toHaveBeenCalledWith('dispute.organisationId = :organisationId', {
      organisationId: 'org-1',
    });
    expect(qb.leftJoin).not.toHaveBeenCalled();
  });

  it('non-admin caller with NO resolved organisationId gets nothing, not everything', async () => {
    const { service, qb } = makeService([{ id: 'd1' }, { id: 'd2' }]);
    const result = await service.findAll('u1', 'OWNER', {} as any, 'CLINIC', undefined);
    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);
    expect(qb.getManyAndCount).not.toHaveBeenCalled();
  });
});

// T16 (scope/TRACKER.md): dispute.organisationId is always the raising
// clinic's org id (mapped from the disputes table's own clinicId column) —
// it can never match a manufacturer's own organisationId, so a manufacturer
// caller got zero rows here, always, even for disputes on their own orders.
// Fix scoped narrowly to this one under-scoping bug — no other dispute
// behavior touched.
describe('DisputesService.findAll — T16 manufacturer scoping', () => {
  it('MANUFACTURER caller is scoped via order.items.manufacturerId, not dispute.organisationId', async () => {
    const { service, qb } = makeService([{ id: 'd1' }]);
    const result = await service.findAll('u1', 'OWNER', {} as any, 'MANUFACTURER', 'mfg-1');

    expect(qb.leftJoin).toHaveBeenCalledWith('order.items', 'items');
    expect(qb.andWhere).toHaveBeenCalledWith('items.manufacturerId = :organisationId', {
      organisationId: 'mfg-1',
    });
    // The old (buggy) filter must NOT also be applied -- a manufacturer's
    // organisationId would never match dispute.organisationId anyway, but
    // asserting its absence makes the fix's intent explicit here.
    expect(qb.andWhere).not.toHaveBeenCalledWith('dispute.organisationId = :organisationId', {
      organisationId: 'mfg-1',
    });
    expect(result.data).toHaveLength(1);
  });

  it('MANUFACTURER caller with no resolved organisationId still gets nothing (SEC-7 guard applies to both branches)', async () => {
    const { service, qb } = makeService([{ id: 'd1' }]);
    const result = await service.findAll('u1', 'OWNER', {} as any, 'MANUFACTURER', undefined);
    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);
    expect(qb.getManyAndCount).not.toHaveBeenCalled();
  });
});
