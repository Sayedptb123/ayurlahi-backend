import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Product } from '../products/entities/product.entity';

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
    // T25 (2026-09-16): the PACKED branch's transaction now re-fetches the
    // order WITH a pessimistic lock and re-checks packedAt before doing
    // anything else. In production that's a genuinely fresh DB read -- the
    // outer `order.packedAt = new Date()` a few lines up in updateStatus()
    // is only an in-memory mutation until this transaction commits, so the
    // real locked read still sees packedAt as null. Echoing the same
    // (already-mutated) `order` object back here would trip the new
    // already-packed guard on every call, so this returns a shallow clone
    // with packedAt forced back to null instead.
    findOne: jest.fn(() => Promise.resolve({ ...order, packedAt: null })),
    manager: { getRepository: jest.fn(() => genericSubRepo()) },
  };
  // T25: items are fetched separately inside the transaction (a pessimistic
  // lock can't be combined with an eager relations join -- see the
  // production comment). Returning `order.items` itself, not a copy, keeps
  // every existing item-level assertion below (`order.items[0].xxx`)
  // working, since the transaction mutates these same object references.
  const orderItemsRepositoryForTx = { find: jest.fn(() => Promise.resolve(order.items || [])) };

  // PACKED now runs inside its own transaction (2026-09-16 fix, see
  // scope/Handoff_Blocker_Fixes_2026-09-16.md #3) -- the transaction
  // callback's manager.getRepository(Product/Order/Invoice/OrderItem) must
  // resolve to these SAME mocks, not fresh copies, so every existing
  // assertion below (productsRepository.increment, ordersRepository.save,
  // invoicesRepository.findOne/save) keeps working whether the real code
  // reaches them directly or via the transactional manager.
  const txManager: any = {
    getRepository: jest.fn((entityClass: any) => {
      if (entityClass === Product) return productsRepository;
      if (entityClass === Order) return ordersRepository;
      if (entityClass === Invoice) return invoicesRepository;
      if (entityClass === OrderItem) return orderItemsRepositoryForTx;
      return genericSubRepo();
    }),
  };
  ordersRepository.manager.transaction = jest.fn((cb: any) => cb(txManager));

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
    // T24 fix (2026-09-16): commission is 5% of totalAmount, not 0.05% --
    // this assertion previously encoded the pre-fix (itemTotal * 0.05) / 100
    // bug's own answer as if it were correct. See the dedicated "T24
    // commission rate" describe block below for the full regression suite.
    expect(item.commissionAmount).toBeCloseTo(63 * 0.05, 6);
  });

  it('order-level totals resync to the invoice at PACKED (pre-existing fix, re-verified alongside this one)', async () => {
    const order = makeOrder({ status: 'processing' });
    const { service, ordersRepository } = makeWriteService(order);

    // T25 (2026-09-16): order-level aggregates are now set on the locked,
    // freshly-re-fetched order inside the transaction, not the stale outer
    // `order` object updateStatus() was originally called with -- assert
    // against the RETURNED (and persisted) order, which is what's
    // authoritative in production too.
    const result = await service.updateStatus(
      'ord-1', 'u1', 'OWNER', 'MANUFACTURER',
      { status: 'packed', items: [{ orderItemId: 'item-1', packedQuantity: 6, discountAmount: 5 }] } as any,
      'org-mfg',
    );

    expect(ordersRepository.save).toHaveBeenCalled();
    expect(result.subtotal).toBe(60);
    expect(result.gstAmount).toBe(3);
    expect(result.discountAmount).toBe(5);
    expect(result.totalAmount).toBe(58); // 60 + 3 - 5
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

  // T25 (2026-09-16, scope/TRACKER.md): two simultaneous PACK requests for
  // the same order must not both succeed. Each request independently
  // fetches its own `order` snapshot via updateStatus()'s top-level
  // findOne() before either commits -- both would see packedAt as null and
  // pass the outer `!order.packedAt` guard. The pessimistic-lock re-check
  // inside the transaction is what's supposed to catch this: whichever
  // request's transaction commits first sets packedAt; the second request's
  // LOCKED re-fetch (which blocks until the first transaction releases the
  // lock) must see that and reject cleanly instead of double-processing.
  //
  // Simulated here by controlling the mocked locked-findOne's return value
  // per call (first call: not yet packed -> succeeds; second call: already
  // packed -> rejected) and resetting the outer `order.packedAt` between
  // calls to stand in for "a second request's own independent fetch,
  // unaffected by the first request's in-memory mutation" -- exactly what a
  // real second HTTP request would look like, just without a second JS
  // object instance to express it with.
  it('T25 — a second concurrent PACK request on the same order is rejected once the first has committed, not double-processed', async () => {
    const order = makeOrder({ status: 'processing' });
    const { service, ordersRepository, productsRepository } = makeWriteService(order);

    ordersRepository.findOne
      .mockResolvedValueOnce({ ...order, packedAt: null }) // 1st request's locked read: not yet packed
      .mockResolvedValueOnce({ ...order, packedAt: new Date() }); // 2nd request's locked read: 1st already committed

    const packDto = { status: 'packed', items: [{ orderItemId: 'item-1', packedQuantity: 10, discountAmount: 0 }] } as any;

    // First request: succeeds, exactly as every other PACKED test in this
    // file.
    await service.updateStatus('ord-1', 'u1', 'OWNER', 'MANUFACTURER', packDto, 'org-mfg');
    expect(productsRepository.increment).not.toHaveBeenCalled(); // full pack, no shortfall to release

    // Second request: simulate its own independent pre-transaction fetch by
    // resetting the shared fixture's packedAt (a real second request would
    // never have seen the first's in-memory mutation at all).
    order.packedAt = null;
    await expect(
      service.updateStatus('ord-1', 'u1', 'OWNER', 'MANUFACTURER', packDto, 'org-mfg'),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Rejected before any further stock mutation -- still exactly the one
    // call (there was none, since this was a full pack) from the first
    // request's transaction.
    expect(productsRepository.increment).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2026-09-13: Post-PACKED Order Correction Workflow
// (scope/Post_PACKED_Correction_Workflow_Design_2026-09-13.md)
// ─────────────────────────────────────────────────────────────────────────

const makeCorrectionFixtures = (overrides: {
  orderStatus?: string;
  invoiceIsPaid?: boolean;
  invoiceCancelled?: boolean;
  callerRole?: string;
  callerOrgType?: string;
  callerOrgId?: string;
  catalogPrice?: number;
} = {}) => {
  const order = {
    id: 'ord-1',
    orderNumber: 'ORD-ORIGINAL-1',
    organisationId: 'org-clinic',
    status: overrides.orderStatus ?? 'packed',
    source: 'marketplace',
    shippingAddress: { line1: '123 St', city: 'Kochi' },
    branchId: 'branch-1',
    metadata: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
  };
  const items = [
    {
      id: 'item-1',
      orderId: 'ord-1',
      productId: 'prod-1',
      manufacturerId: 'org-mfg',
      productSku: 'SKU1',
      productName: 'Widget',
      quantity: 10,
      reservedQuantity: 6, // already-shrunk post-P0-fix value (packed 6 of 10)
      packedQuantity: 6,
      unitPrice: 100, // ORIGINAL agreed price -- must be preserved
      gstRate: 5,
      mrp: 110,
      hsnCode: '1234',
      discountAmount: 0,
      notes: null,
      deletedAt: null,
    },
  ];
  const invoice = {
    id: 'inv-1',
    orderId: 'ord-1',
    isPaid: overrides.invoiceIsPaid ?? false,
    cancelledAt: overrides.invoiceCancelled ? new Date() : null,
    cancelReason: null,
  };
  const product = {
    id: 'prod-1',
    status: 'active',
    minOrderQuantity: 1,
    stockQuantity: 50,
    price: overrides.catalogPrice ?? 150, // TODAY's catalog price -- must NOT leak into the correction
    gstRate: 5,
    mrp: 110,
    hsnCode: '1234',
    manufacturerId: 'org-mfg',
    sku: 'SKU1',
    name: 'Widget',
    deletedAt: null,
  };
  return { order, items, invoice, product };
};

const makeCorrectionService = (fixtures: ReturnType<typeof makeCorrectionFixtures>) => {
  const { order, items, invoice, product } = fixtures;

  const orderRepo = {
    findOne: jest.fn(() => Promise.resolve({ ...order })),
    create: jest.fn((x: any) => x),
    save: jest.fn((x: any) => Promise.resolve({ ...x, id: x.id ?? 'new-order-id' })),
  };
  const itemRepo = { find: jest.fn(() => Promise.resolve(items.map((i) => ({ ...i })))) };
  const invoiceRepo = {
    findOne: jest.fn(() => Promise.resolve({ ...invoice })),
    save: jest.fn((x: any) => Promise.resolve(x)),
  };
  const productRepo = {
    findOne: jest.fn(() => Promise.resolve({ ...product })),
    increment: jest.fn(() => Promise.resolve()),
    decrement: jest.fn(() => Promise.resolve()),
  };

  const manager: any = {
    getRepository: jest.fn((entityClass: any) => {
      if (entityClass === Order) return orderRepo;
      if (entityClass === OrderItem) return itemRepo;
      if (entityClass === Invoice) return invoiceRepo;
      if (entityClass === Product) return productRepo;
      throw new Error(`Unexpected entity class in test: ${entityClass}`);
    }),
  };

  const ordersRepository: any = {
    manager: {
      transaction: jest.fn((cb: any) => cb(manager)),
      getRepository: jest.fn(() => genericSubRepo()),
    },
    findOne: jest.fn(() => Promise.resolve({ ...order, id: 'new-order-id', items })),
  };
  const orgUserRepository = { find: jest.fn(() => Promise.resolve([])) };
  const notificationsService = { sendToUsers: jest.fn(() => Promise.resolve()) };
  const productsRepository = { manager: { transaction: jest.fn((cb: any) => cb(manager)) } };

  const service = new OrdersService(
    ordersRepository,
    {} as any, // orderItemsRepository
    productsRepository as any,
    {} as any, // usersRepository
    orgUserRepository as any,
    invoiceRepo as any, // invoicesRepository (top-level injected repo, unused directly by correctPackedOrder)
    {} as any, // externalOrderAccessRepository
    {} as any, // orderReplacementsRepository
    {} as any, // disputesRepository
    {} as any, // branchesRepository
    {} as any, // inventoryService
    notificationsService as any,
  );

  return { service, orderRepo, itemRepo, invoiceRepo, productRepo };
};

const CORRECT_DTO = { reason: 'wrong_quantity' as const, notes: 'packed 6 instead of 10' };

// T24 (2026-09-16): commissionAmount was computed as (itemTotal * 0.05) / 100
// at all 4 sites that set it -- 0.05 is already the decimal form of the 5%
// rate, so dividing by 100 again silently produced 0.05% instead of 5%.
// Fixed to itemTotal * 0.05 everywhere. Canonical example used throughout:
// itemTotal = Rs 10,000 (achieved via a 0% GST product so subtotal ==
// itemTotal, keeping the arithmetic unambiguous) -> expected commission =
// Rs 500, never Rs 5.
describe('OrdersService — T24 commission rate (5%, not 0.05%)', () => {
    const RATE_PRODUCT = {
        id: 'prod-1',
        name: 'Widget',
        sku: 'SKU1',
        price: 10000,
        gstRate: 0, // 0% GST keeps itemTotal === itemSubtotal === 10,000, so the
        // commission math is unambiguous -- no GST component to account for.
        minOrderQuantity: 1,
        status: 'active',
        stockQuantity: 10,
        manufacturerId: 'org-mfg',
        mrp: null,
        hsnCode: null,
    };

    // Site #1: order creation / correctPackedOrder's replacement order, via
    // the shared private lockAndSnapshotOrderItems(). Supplying an
    // externalManager bypasses the need to mock productsRepository.manager
    // at all -- this method's only DB dependency when given one.
    it('site #1 — lockAndSnapshotOrderItems (order creation): Rs 10,000 item -> Rs 500 commission', async () => {
        const service = new OrdersService(
            {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
            {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
        );
        const fakeManager: any = {
            getRepository: jest.fn(() => ({
                findOne: jest.fn(() => Promise.resolve({ ...RATE_PRODUCT })),
                decrement: jest.fn(() => Promise.resolve()),
            })),
        };
        const { orderItems } = await (service as any).lockAndSnapshotOrderItems(
            [{ productId: 'prod-1', quantity: 1 }],
            undefined,
            fakeManager,
        );
        expect(orderItems[0].totalAmount).toBe(10000);
        expect(orderItems[0].commissionAmount).toBe(500);
        expect(orderItems[0].commissionAmount).not.toBeCloseTo(5, 5); // the old (÷100 twice) bug's answer
    });

    // Site #2: PACKED-transition resync, via the real updateStatus() entry
    // point and the existing makeWriteService harness.
    it('site #2 — PACKED-transition resync: Rs 10,000 packed item -> Rs 500 commission', async () => {
        const order = makeOrder({
            status: 'processing',
            items: [makeOrderItem({ quantity: 1, reservedQuantity: 1, unitPrice: 10000, gstRate: 0, subtotal: 10000, gstAmount: 0, totalAmount: 10000 })],
        });
        const { service } = makeWriteService(order);

        await service.updateStatus(
            'ord-1', 'u1', 'OWNER', 'MANUFACTURER',
            { status: 'packed', items: [{ orderItemId: 'item-1', packedQuantity: 1, discountAmount: 0 }] } as any,
            'org-mfg',
        );

        expect(order.items[0].totalAmount).toBe(10000);
        expect(order.items[0].commissionAmount).toBe(500);
        expect(order.items[0].commissionAmount).not.toBeCloseTo(5, 5);
    });

    // Site #3: addOrderItem (amendment). isAdmin bypasses the
    // product.manufacturerId ownership check so the fixture doesn't need to
    // thread organisationId through -- irrelevant to the commission math
    // being tested here.
    it('site #3 — addOrderItem (amendment): Rs 10,000 item -> Rs 500 commission', async () => {
        const order = makeOrder({ status: 'processing', items: [] });
        const productRepo = {
            findOne: jest.fn(() => Promise.resolve({ ...RATE_PRODUCT })),
            decrement: jest.fn(() => Promise.resolve()),
        };
        const productsRepository: any = {
            manager: { transaction: jest.fn((cb: any) => cb({ getRepository: jest.fn(() => productRepo) })) },
        };
        const ordersRepository: any = { save: jest.fn((x: any) => Promise.resolve(x)) };
        const service = new OrdersService(
            ordersRepository,
            {} as any, // orderItemsRepository
            productsRepository,
            {} as any, // usersRepository
            {} as any, // orgUserRepository
            {} as any, // invoicesRepository
            {} as any, // externalOrderAccessRepository
            {} as any, // orderReplacementsRepository
            {} as any, // disputesRepository
            {} as any, // branchesRepository
            {} as any, // inventoryService
            {} as any, // notificationsService
        );
        jest.spyOn(service, 'findOne').mockResolvedValue(order);

        await service.addOrderItem('ord-1', 'u1', 'SUPER_ADMIN', 'AYURLAHI_TEAM', undefined, { productId: 'prod-1', quantity: 1 } as any);

        const added = order.items.find((i: any) => i.productId === 'prod-1');
        expect(added.totalAmount).toBe(10000);
        expect(added.commissionAmount).toBe(500);
        expect(added.commissionAmount).not.toBeCloseTo(5, 5);
    });

    // Site #4: updateOrderItemQuantity (amendment). Quantity held at 1 so
    // the stock-delta branch is a no-op -- irrelevant to the commission math.
    it('site #4 — updateOrderItemQuantity (amendment): Rs 10,000 item -> Rs 500 commission', async () => {
        const item = makeOrderItem({
            id: 'item-1', productId: 'prod-1', quantity: 1, reservedQuantity: 1,
            unitPrice: 10000, gstRate: 0, commissionAmount: 0,
        });
        const order = makeOrder({ status: 'processing', items: [item] });
        const productRepo = {
            findOne: jest.fn(() => Promise.resolve({ ...RATE_PRODUCT, stockQuantity: 0 })),
            increment: jest.fn(() => Promise.resolve()),
            decrement: jest.fn(() => Promise.resolve()),
        };
        const productsRepository: any = {
            manager: { transaction: jest.fn((cb: any) => cb({ getRepository: jest.fn(() => productRepo) })) },
        };
        const ordersRepository: any = { save: jest.fn((x: any) => Promise.resolve(x)) };
        const service = new OrdersService(
            ordersRepository,
            {} as any, // orderItemsRepository
            productsRepository,
            {} as any, // usersRepository
            {} as any, // orgUserRepository
            {} as any, // invoicesRepository
            {} as any, // externalOrderAccessRepository
            {} as any, // orderReplacementsRepository
            {} as any, // disputesRepository
            {} as any, // branchesRepository
            {} as any, // inventoryService
            {} as any, // notificationsService
        );
        jest.spyOn(service, 'findOne').mockResolvedValue(order);

        await service.updateOrderItemQuantity('ord-1', 'item-1', 'u1', 'SUPER_ADMIN', 'AYURLAHI_TEAM', undefined, { quantity: 1 } as any);

        expect(item.totalAmount).toBe(10000);
        expect(item.commissionAmount).toBe(500);
        expect(item.commissionAmount).not.toBeCloseTo(5, 5);
    });
});

describe('OrdersService.correctPackedOrder — Post-PACKED Order Correction Workflow', () => {
  it('happy path: cancels original, restores stock, voids invoice, creates a linked replacement at the ORIGINAL price (not catalog)', async () => {
    const fixtures = makeCorrectionFixtures({ catalogPrice: 150 }); // catalog has since moved to 150; original was 100
    const { service, orderRepo, invoiceRepo, productRepo } = makeCorrectionService(fixtures);

    await service.correctPackedOrder('ord-1', 'u1', 'OWNER', 'MANUFACTURER', 'org-mfg', CORRECT_DTO);

    // Original order cancelled with reservedQuantity (6), not the full requested quantity (10).
    expect(productRepo.increment).toHaveBeenCalledWith({ id: 'prod-1' }, 'stockQuantity', 6);

    // Invoice financially cancelled, never had its amounts/items touched.
    expect(invoiceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ cancelledAt: expect.any(Date), cancelReason: 'wrong_quantity' }),
    );

    // The original order was saved cancelled, with a link to the replacement.
    const originalSaveCall = orderRepo.save.mock.calls.find((c: any) => c[0].status === 'cancelled');
    expect(originalSaveCall).toBeDefined();
    expect(originalSaveCall![0].cancelledBy).toBe('u1');
    expect(originalSaveCall![0].metadata.correctedByOrderId).toBe('new-order-id');

    // The replacement order was created with the ORIGINAL price (100), not today's catalog price (150).
    const newOrderSaveCall = orderRepo.save.mock.calls.find((c: any) => c[0].status === 'pending');
    expect(newOrderSaveCall).toBeDefined();
    const newItems = newOrderSaveCall![0].items;
    expect(newItems[0].unitPrice).toBe(100);
    expect(newItems[0].quantity).toBe(10); // original REQUESTED quantity, not packedQuantity
    expect(newOrderSaveCall![0].metadata.correctsOrderId).toBe('ord-1');

    // Ownership copied from the ORIGINAL order, not the calling manufacturer's own org.
    expect(newOrderSaveCall![0].organisationId).toBe('org-clinic');
    expect(newOrderSaveCall![0].branchId).toBe('branch-1');
  });

  it('rejects a paid invoice — Case B is explicitly not self-service', async () => {
    const fixtures = makeCorrectionFixtures({ invoiceIsPaid: true });
    const { service } = makeCorrectionService(fixtures);

    await expect(
      service.correctPackedOrder('ord-1', 'u1', 'OWNER', 'MANUFACTURER', 'org-mfg', CORRECT_DTO),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects an order that is not PACKED', async () => {
    const fixtures = makeCorrectionFixtures({ orderStatus: 'shipped' });
    const { service } = makeCorrectionService(fixtures);

    await expect(
      service.correctPackedOrder('ord-1', 'u1', 'OWNER', 'MANUFACTURER', 'org-mfg', CORRECT_DTO),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an order whose invoice was already corrected (idempotency)', async () => {
    const fixtures = makeCorrectionFixtures({ invoiceCancelled: true });
    const { service } = makeCorrectionService(fixtures);

    await expect(
      service.correctPackedOrder('ord-1', 'u1', 'OWNER', 'MANUFACTURER', 'org-mfg', CORRECT_DTO),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects the clinic that placed the order — only manufacturer/admin may correct', async () => {
    const fixtures = makeCorrectionFixtures();
    const { service } = makeCorrectionService(fixtures);

    await expect(
      service.correctPackedOrder('ord-1', 'u1', 'OWNER', 'CLINIC', 'org-clinic', CORRECT_DTO),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a manufacturer with no items on this order', async () => {
    const fixtures = makeCorrectionFixtures();
    const { service } = makeCorrectionService(fixtures);

    await expect(
      service.correctPackedOrder('ord-1', 'u1', 'OWNER', 'MANUFACTURER', 'org-some-other-mfg', CORRECT_DTO),
    ).rejects.toThrow(ForbiddenException);
  });

  it('AYURLAHI_TEAM admin/support can correct any order', async () => {
    const fixtures = makeCorrectionFixtures();
    const { service, orderRepo } = makeCorrectionService(fixtures);

    await service.correctPackedOrder('ord-1', 'u1', 'SUPER_ADMIN', 'AYURLAHI_TEAM', undefined, CORRECT_DTO);

    expect(orderRepo.save).toHaveBeenCalled();
  });
});

// 2026-09-13: human-friendly order numbers (ORD-YYYYMMDD-XXXX), replacing
// ORD-<epoch ms>-<9 random chars>.
describe('OrdersService.generateOrderNumber / saveOrderRetryingOnNumberCollision', () => {
  it('produces ORD-YYYYMMDD-XXXX with today\'s date and a 4-char base36 code', () => {
    const { service } = makeWriteService(makeOrder());
    const orderNumber: string = (service as any).generateOrderNumber();
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    expect(orderNumber).toMatch(new RegExp(`^ORD-${y}${m}${d}-[0-9A-Z]{4}$`));
  });

  it('retries with a fresh number on a unique-constraint collision, then succeeds', async () => {
    const { service } = makeWriteService(makeOrder());
    let attempts = 0;
    const seenNumbers: string[] = [];
    const result = await (service as any).saveOrderRetryingOnNumberCollision((orderNumber: string) => {
      attempts += 1;
      seenNumbers.push(orderNumber);
      if (attempts < 2) {
        const err: any = new Error('duplicate key value violates unique constraint');
        err.code = '23505';
        return Promise.reject(err);
      }
      return Promise.resolve({ orderNumber });
    });
    expect(attempts).toBe(2);
    expect(result.orderNumber).toBe(seenNumbers[1]);
    expect(seenNumbers[0]).not.toBe(seenNumbers[1]); // a fresh number was generated for the retry
  });

  it('does not retry on a non-collision error', async () => {
    const { service } = makeWriteService(makeOrder());
    const otherError = new Error('something else entirely');
    await expect(
      (service as any).saveOrderRetryingOnNumberCollision(() => Promise.reject(otherError)),
    ).rejects.toThrow('something else entirely');
  });
});
