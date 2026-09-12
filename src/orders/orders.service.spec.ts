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

// ─────────────────────────────────────────────────────────────────────────
// 2026-09-12 audit fix: PACKED reservation/money sync
//
// P0 (HIGH): packing released a shortfall back to product.stockQuantity
// without shrinking item.reservedQuantity to match. A later legal
// PACKED -> CANCELLED then restored the item's ORIGINAL reservedQuantity on
// top of what packing had already released -- double-crediting stock.
//
// P1 (MEDIUM): item.subtotal/gstAmount/totalAmount/commissionAmount stayed
// frozen at their originally-requested-quantity values forever, corrupting
// any analytics query that sums them (e.g. "Top Selling Medicines").
// ─────────────────────────────────────────────────────────────────────────

const makeOrderItem = (overrides: Partial<any> = {}) => ({
  id: 'item-1',
  orderId: 'ord-1',
  productId: 'prod-1',
  manufacturerId: 'org-mfg',
  productSku: 'SKU1',
  productName: 'Widget',
  quantity: 10,
  reservedQuantity: 10,
  unitPrice: 10,
  mrp: null,
  hsnCode: null,
  gstRate: 5,
  subtotal: 100,
  gstAmount: 5,
  totalAmount: 105,
  commissionAmount: (105 * 0.05) / 100,
  packedQuantity: 0,
  discountAmount: 0,
  deletedAt: null,
  status: 'pending',
  ...overrides,
});

const makeOrder = (overrides: Partial<any> = {}) => ({
  id: 'ord-1',
  organisationId: 'org-clinic',
  orderNumber: 'ORD-TEST-1',
  status: 'processing',
  source: 'marketplace',
  subtotal: 100,
  gstAmount: 5,
  totalAmount: 105,
  discountAmount: 0,
  shippingCharges: 0,
  platformFee: 0,
  branchId: null,
  shippingAddress: null,
  metadata: null,
  packedAt: null,
  shippedAt: null,
  deliveredAt: null,
  cancelledAt: null,
  items: [makeOrderItem()],
  ...overrides,
});

const genericSubRepo = () => {
  const qb: any = {
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    addOrderBy: jest.fn(() => qb),
    getOne: jest.fn(() => Promise.resolve(null)),
  };
  return {
    findOne: jest.fn(() => Promise.resolve(null)),
    find: jest.fn(() => Promise.resolve([])),
    createQueryBuilder: jest.fn(() => qb),
  };
};

// Full write-path harness (unlike the read-path makeService above): stubs
// every repo/service updateStatus's PACKED/CANCELLED branches touch, and
// spies on the service's own findOne() so the order fixture is returned
// directly rather than re-deriving it through findOne's own org-scope/
// attach-names machinery (already covered by the SEC-7 tests above).
const makeWriteService = (order: any, inventoryService: any = {}) => {
  const productsRepository = { increment: jest.fn(() => Promise.resolve()) };
  const branchesRepository = {
    count: jest.fn(() => Promise.resolve(0)), // branch-less org -- resolveDeliveryBranchId short-circuits to null
    findOne: jest.fn(() => Promise.resolve(null)),
  };
  const invoicesRepository = {
    findOne: jest.fn(() => Promise.resolve(null)), // no existing invoice yet
    create: jest.fn((x: any) => x),
    save: jest.fn((x: any) => Promise.resolve({ ...x, id: 'inv-1' })),
  };
  const orgUserRepository = { find: jest.fn(() => Promise.resolve([])) };
  const notificationsService = { sendToUsers: jest.fn(() => Promise.resolve()) };
  const ordersRepository: any = {
    save: jest.fn((x: any) => Promise.resolve(x)),
    manager: { getRepository: jest.fn(() => genericSubRepo()) },
  };
  const service = new OrdersService(
    ordersRepository,
    {} as any, // orderItemsRepository
    productsRepository as any,
    {} as any, // usersRepository
    orgUserRepository as any,
    invoicesRepository as any,
    {} as any, // externalOrderAccessRepository
    {} as any, // orderReplacementsRepository
    {} as any, // disputesRepository
    branchesRepository as any,
    inventoryService as any,
    notificationsService as any,
  );
  jest.spyOn(service, 'findOne').mockResolvedValue(order);
  return { service, ordersRepository, productsRepository, invoicesRepository };
};

describe('OrdersService.updateStatus — PACKED reservation/money sync', () => {
  it('full packing (no shortfall): reservedQuantity unchanged, no stock release, item totals unchanged', async () => {
    const order = makeOrder({ status: 'processing' });
    const { service, productsRepository } = makeWriteService(order);

    await service.updateStatus(
      'ord-1', 'u1', 'OWNER', 'MANUFACTURER',
      { status: 'packed', items: [{ orderItemId: 'item-1', packedQuantity: 10, discountAmount: 0 }] } as any,
      'org-mfg',
    );

    expect(productsRepository.increment).not.toHaveBeenCalled();
    expect(order.items[0].reservedQuantity).toBe(10);
    expect(order.items[0].packedQuantity).toBe(10);
    expect(order.items[0].subtotal).toBe(100);
    expect(order.items[0].totalAmount).toBe(105);
  });

  it('partial packing (shortfall of 4): releases exactly 4, shrinks reservedQuantity to packedQuantity, resyncs item money to packed amount', async () => {
    const order = makeOrder({ status: 'processing' });
    const { service, productsRepository } = makeWriteService(order);

    await service.updateStatus(
      'ord-1', 'u1', 'OWNER', 'MANUFACTURER',
      { status: 'packed', items: [{ orderItemId: 'item-1', packedQuantity: 6, discountAmount: 0 }] } as any,
      'org-mfg',
    );

    expect(productsRepository.increment).toHaveBeenCalledTimes(1);
    expect(productsRepository.increment).toHaveBeenCalledWith({ id: 'prod-1' }, 'stockQuantity', 4);

    const item = order.items[0];
    expect(item.reservedQuantity).toBe(6); // shrunk, not left at original 10
    expect(item.packedQuantity).toBe(6);
    expect(item.subtotal).toBe(60);        // 10 unitPrice * 6 packed, not 10 requested
    expect(item.gstAmount).toBe(3);        // 60 * 5%
    expect(item.totalAmount).toBe(63);
    expect(item.commissionAmount).toBeCloseTo((63 * 0.05) / 100, 6);
  });

  it('order-level totals resync to the invoice at PACKED (pre-existing fix, re-verified alongside this one)', async () => {
    const order = makeOrder({ status: 'processing' });
    const { service, ordersRepository } = makeWriteService(order);

    await service.updateStatus(
      'ord-1', 'u1', 'OWNER', 'MANUFACTURER',
      { status: 'packed', items: [{ orderItemId: 'item-1', packedQuantity: 6, discountAmount: 5 }] } as any,
      'org-mfg',
    );

    expect(ordersRepository.save).toHaveBeenCalled();
    expect(order.subtotal).toBe(60);
    expect(order.gstAmount).toBe(3);
    expect(order.discountAmount).toBe(5);
    expect(order.totalAmount).toBe(58); // 60 + 3 - 5
  });

  it('THE REGRESSION: PACKED-with-shortfall then CANCELLED restores only what is still reserved, not the original reservation (no double-restore)', async () => {
    const order = makeOrder({ status: 'processing' });
    const { service, productsRepository } = makeWriteService(order);

    // Step 1: pack 6 of 10 -- releases 4, shrinks reservedQuantity to 6.
    await service.updateStatus(
      'ord-1', 'u1', 'OWNER', 'MANUFACTURER',
      { status: 'packed', items: [{ orderItemId: 'item-1', packedQuantity: 6, discountAmount: 0 }] } as any,
      'org-mfg',
    );
    expect(productsRepository.increment).toHaveBeenNthCalledWith(1, { id: 'prod-1' }, 'stockQuantity', 4);

    // Step 2: cancel the now-PACKED order (a real, legal transition).
    await service.updateStatus(
      'ord-1', 'u1', 'OWNER', 'MANUFACTURER',
      { status: 'cancelled' } as any,
      'org-mfg',
    );

    // Total ever credited back across both calls must equal exactly the
    // original reservation (10) -- 4 at packing + 6 at cancellation, never
    // 4 + 10 = 14 (the pre-fix bug).
    expect(productsRepository.increment).toHaveBeenCalledTimes(2);
    expect(productsRepository.increment).toHaveBeenNthCalledWith(2, { id: 'prod-1' }, 'stockQuantity', 6);
    const totalRestored = (productsRepository.increment as jest.Mock).mock.calls
      .reduce((sum, call) => sum + (call[2] as number), 0);
    expect(totalRestored).toBe(10);
  });

  it('cancellation BEFORE packing still restores the full original reservation (unaffected by this fix)', async () => {
    const order = makeOrder({ status: 'confirmed' }); // never packed -- packedQuantity stays 0
    const { service, productsRepository } = makeWriteService(order);

    await service.updateStatus(
      'ord-1', 'u1', 'OWNER', 'MANUFACTURER',
      { status: 'cancelled' } as any,
      'org-mfg',
    );

    expect(productsRepository.increment).toHaveBeenCalledTimes(1);
    expect(productsRepository.increment).toHaveBeenCalledWith({ id: 'prod-1' }, 'stockQuantity', 10);
  });

  it('PACKED -> SHIPPED -> DELIVERED: no further stock-release calls, packedQuantity carries through unchanged', async () => {
    const order = makeOrder({ status: 'packed', packedAt: new Date(), items: [makeOrderItem({ reservedQuantity: 6, packedQuantity: 6 })] });
    const inventoryService = { addStock: jest.fn(() => Promise.resolve()) };
    const { service, productsRepository } = makeWriteService(order, inventoryService);

    await service.updateStatus('ord-1', 'u1', 'OWNER', 'MANUFACTURER', { status: 'shipped' } as any, 'org-mfg');
    await service.updateStatus('ord-1', 'u1', 'OWNER', 'MANUFACTURER', { status: 'delivered' } as any, 'org-mfg');

    expect(productsRepository.increment).not.toHaveBeenCalled(); // no stock-reservation math at these transitions
    expect(inventoryService.addStock).toHaveBeenCalledTimes(1); // clinic-side stock credit, keyed off packedQuantity
    expect(order.items[0].packedQuantity).toBe(6);
    expect(order.items[0].reservedQuantity).toBe(6);
  });
});
