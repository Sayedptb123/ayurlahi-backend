import { ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service';

// SEC-7 regression: OrdersService.findAll/findOne used to fall through to
// unfiltered/global visibility whenever organisationType was neither
// 'CLINIC' nor 'MANUFACTURER' (including undefined, from an unresolved
// current-org lookup at login). Only AYURLAHI_TEAM may see every order;
// everything else must be denied.

const makeQueryBuilder = (rows: any[]) => {
  const qb: any = {
    leftJoinAndSelect: jest.fn(() => qb),
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    skip: jest.fn(() => qb),
    take: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    getCount: jest.fn(() => Promise.resolve(rows.length)),
    getMany: jest.fn(() => Promise.resolve(rows)),
  };
  return qb;
};

const makeOrdersRepository = (rows: any[]) => {
  const qb = makeQueryBuilder(rows);
  return {
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn(() => Promise.resolve(rows[0] ?? null)),
    manager: {
      getRepository: jest.fn(() => ({ find: jest.fn(() => Promise.resolve([])) })),
    },
    __qb: qb,
  };
};

const noop = () => ({ find: jest.fn(() => Promise.resolve([])) });

const makeService = (rows: any[]) => {
  const ordersRepository = makeOrdersRepository(rows);
  const service = new OrdersService(
    ordersRepository as any,
    noop() as any, // orderItemsRepository
    noop() as any, // productsRepository
    noop() as any, // usersRepository
    noop() as any, // orgUserRepository
    noop() as any, // invoicesRepository
    noop() as any, // externalOrderAccessRepository
    noop() as any, // orderReplacementsRepository
    noop() as any, // disputesRepository
    noop() as any, // branchesRepository
    {} as any, // inventoryService
    {} as any, // notificationsService
  );
  return { service, ordersRepository };
};

describe('OrdersService.findAll — SEC-7 org-scoping', () => {
  const query = {} as any;

  it('CLINIC caller is scoped to their own organisation', async () => {
    const { service, ordersRepository } = makeService([]);
    await service.findAll('u1', 'OWNER', 'CLINIC', query, 'org-clinic');
    expect(ordersRepository.__qb.andWhere).toHaveBeenCalledWith(
      'order.organisation_id = :orgId',
      { orgId: 'org-clinic' },
    );
  });

  it('MANUFACTURER caller is scoped to their own organisation', async () => {
    const { service, ordersRepository } = makeService([]);
    await service.findAll('u1', 'OWNER', 'MANUFACTURER', query, 'org-mfg');
    expect(ordersRepository.__qb.andWhere).toHaveBeenCalledWith(
      'items.manufacturerId = :manufacturerId',
      { manufacturerId: 'org-mfg' },
    );
  });

  it('AYURLAHI_TEAM caller retains global visibility (no org filter)', async () => {
    const { service, ordersRepository } = makeService([{ id: 'o1' }]);
    const result = await service.findAll('u1', 'SUPER_ADMIN', 'AYURLAHI_TEAM', query, undefined);
    expect(ordersRepository.__qb.andWhere).not.toHaveBeenCalled();
    expect(result.data).toHaveLength(1);
  });

  it('undefined organisationType (unresolved current-org lookup) is denied, not global', async () => {
    const { service, ordersRepository } = makeService([{ id: 'o1' }]);
    const result = await service.findAll('u1', 'OWNER', undefined, query, undefined);
    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);
    expect(ordersRepository.__qb.getMany).not.toHaveBeenCalled();
  });

  it('an unrecognised organisationType is denied, not global', async () => {
    const { service } = makeService([{ id: 'o1' }]);
    const result = await service.findAll('u1', 'OWNER', 'SOME_FUTURE_TYPE' as any, query, 'org-x');
    expect(result.data).toEqual([]);
  });

  it('CLINIC caller with no resolvable organisationId gets nothing (pre-existing behavior, unchanged)', async () => {
    const { service } = makeService([{ id: 'o1' }]);
    const result = await service.findAll('u1', 'OWNER', 'CLINIC', query, undefined);
    expect(result.data).toEqual([]);
  });
});

describe('OrdersService.findOne — SEC-7 org-scoping', () => {
  const order = { id: 'ord-1', organisationId: 'org-clinic', items: [{ manufacturerId: 'org-mfg' }] };

  it('CLINIC caller from the owning org can read the order', async () => {
    const { service } = makeService([order]);
    await expect(
      service.findOne('ord-1', 'u1', 'OWNER', 'CLINIC', 'org-clinic'),
    ).resolves.toMatchObject({ id: 'ord-1' });
  });

  it('CLINIC caller from a different org is denied (cross-org read)', async () => {
    const { service } = makeService([order]);
    await expect(
      service.findOne('ord-1', 'u1', 'OWNER', 'CLINIC', 'org-other-clinic'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('MANUFACTURER caller with items on the order can read it', async () => {
    const { service } = makeService([order]);
    await expect(
      service.findOne('ord-1', 'u1', 'OWNER', 'MANUFACTURER', 'org-mfg'),
    ).resolves.toMatchObject({ id: 'ord-1' });
  });

  it('AYURLAHI_TEAM caller can read any order', async () => {
    const { service } = makeService([order]);
    await expect(
      service.findOne('ord-1', 'u1', 'SUPER_ADMIN', 'AYURLAHI_TEAM', undefined),
    ).resolves.toMatchObject({ id: 'ord-1' });
  });

  it('undefined organisationType is denied, not treated as admin', async () => {
    const { service } = makeService([order]);
    await expect(
      service.findOne('ord-1', 'u1', 'OWNER', undefined, undefined),
    ).rejects.toThrow(ForbiddenException);
  });

  it('an unresolved-organisation caller (valid JWT, no current org) is denied', async () => {
    const { service } = makeService([order]);
    await expect(
      service.findOne('ord-1', 'u1', 'OWNER', undefined, 'org-clinic'),
    ).rejects.toThrow(ForbiddenException);
  });
});
