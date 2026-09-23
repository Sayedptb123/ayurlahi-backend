import { BadRequestException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

// Usage Event Registry (Tracking Phase 1) -- see
// scope/Usage_Event_Registry_Implementation_Plan.md "Tests". Only
// recordEvents()/filterMetadata() are exercised here; the other 17
// injected repositories are unused stubs.

const makeService = (registeredTypes: any[]) => {
  const usageEventTypeRepository = {
    find: jest.fn().mockResolvedValue(registeredTypes),
  };
  const usageEventRepository = {
    create: jest.fn((e: any) => e),
    save: jest.fn((events: any[]) => Promise.resolve(events)),
  };
  const unused = {} as any;
  const service = new AnalyticsService(
    unused, unused, unused, unused, unused, unused, unused, unused,
    usageEventRepository as any,
    usageEventTypeRepository as any,
    unused, unused, unused, unused, unused, unused, unused, unused,
  );
  return { service, usageEventRepository, usageEventTypeRepository };
};

const activeType = (code: string, allowedMetadataKeys: string[] | null = null) => ({
  code,
  isActive: true,
  allowedMetadataKeys,
});

describe('AnalyticsService.recordEvents', () => {
  it('persists all events when every eventType is registered and active (test #1)', async () => {
    const { service, usageEventRepository } = makeService([
      activeType('screen_view'),
      activeType('search'),
    ]);

    const result = await service.recordEvents(
      [{ eventType: 'screen_view' }, { eventType: 'search' }],
      'org-1',
      'user-1',
    );

    expect(result).toEqual({ success: true, count: 2 });
    expect(usageEventRepository.save).toHaveBeenCalledTimes(1);
    expect(usageEventRepository.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ eventType: 'screen_view' }),
        expect.objectContaining({ eventType: 'search' }),
      ]),
    );
  });

  it('rejects the whole batch and persists nothing when one eventType is unregistered (test #2)', async () => {
    const { service, usageEventRepository } = makeService([activeType('screen_view')]);

    await expect(
      service.recordEvents(
        [{ eventType: 'screen_view' }, { eventType: 'nonsense_event' }],
        'org-1',
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(usageEventRepository.save).not.toHaveBeenCalled();
  });

  it('rejects the whole batch and persists nothing when one eventType is registered but inactive (test #3)', async () => {
    const { service, usageEventRepository } = makeService([
      activeType('screen_view'),
      { code: 'retired_event', isActive: false, allowedMetadataKeys: null },
    ]);

    await expect(
      service.recordEvents(
        [{ eventType: 'screen_view' }, { eventType: 'retired_event' }],
        'org-1',
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(usageEventRepository.save).not.toHaveBeenCalled();
  });

  it('returns { success: true, count: 0 } for an empty events array without touching the DB (test #4)', async () => {
    const { service, usageEventRepository, usageEventTypeRepository } = makeService([]);

    const result = await service.recordEvents([], 'org-1', 'user-1');

    expect(result).toEqual({ success: true, count: 0 });
    expect(usageEventTypeRepository.find).not.toHaveBeenCalled();
    expect(usageEventRepository.save).not.toHaveBeenCalled();
  });

  // Real-server check (2026-09-23): an event with no eventType field at all
  // still resolves through TypeORM's real In() against real Postgres
  // without crashing (400, not 500) -- confirmed once against the live
  // app; this test guards the application-level rejection, not the
  // TypeORM/Postgres behavior itself.
  it('rejects cleanly (400, not a crash) when an event has no eventType field', async () => {
    const { service, usageEventRepository } = makeService([activeType('screen_view')]);

    await expect(
      service.recordEvents([{ screenName: 'no eventType here' }], 'org-1', 'user-1'),
    ).rejects.toThrow(BadRequestException);

    expect(usageEventRepository.save).not.toHaveBeenCalled();
  });
});

describe('AnalyticsService.filterMetadata (private, via recordEvents)', () => {
  it('drops metadata keys outside the allowlist (test #5)', async () => {
    const { service, usageEventRepository } = makeService([
      activeType('search', ['screen', 'resultCount']),
    ]);

    await service.recordEvents(
      [{ eventType: 'search', metadata: { screen: 'patients', resultCount: 7, patientName: 'John Doe' } }],
      'org-1',
      'user-1',
    );

    const saved = usageEventRepository.save.mock.calls[0][0];
    expect(saved[0].metadata).toEqual({ screen: 'patients', resultCount: 7 });
    expect(saved[0].metadata.patientName).toBeUndefined();
  });

  it('passes metadata through unchanged when the event has no allowlist yet (test #6)', async () => {
    const { service, usageEventRepository } = makeService([activeType('screen_view', null)]);

    await service.recordEvents(
      [{ eventType: 'screen_view', metadata: { anything: 'goes', another: 1 } }],
      'org-1',
      'user-1',
    );

    const saved = usageEventRepository.save.mock.calls[0][0];
    expect(saved[0].metadata).toEqual({ anything: 'goes', another: 1 });
  });

  it('does not throw when metadata is undefined even with an allowlist present (test #7)', async () => {
    const { service, usageEventRepository } = makeService([
      activeType('search', ['screen']),
    ]);

    await expect(
      service.recordEvents([{ eventType: 'search' }], 'org-1', 'user-1'),
    ).resolves.toEqual({ success: true, count: 1 });

    const saved = usageEventRepository.save.mock.calls[0][0];
    expect(saved[0].metadata).toBeUndefined();
  });
});

describe('AnalyticsService.recordEvents — full seed regression guard (test #8)', () => {
  const ALL_25_CODES = [
    'app_open', 'app_foreground', 'app_background', 'screen_view', 'search',
    'add_to_cart', 'promo_impression', 'promo_click', 'promo_dismiss',
    'push_notification_click', 'checkout_started', 'checkout_completed',
    'appointment_created', 'patient_created', 'registration_started',
    'registration_completed', 'bill_created', 'booking_created',
    'booking_edited', 'booking_cancelled', 'booking_confirmed',
    'booking_checked_in', 'booking_removed', 'booking_refund_recorded',
    'booking_promoted_to_patient',
  ];

  it.each(ALL_25_CODES)('accepts the currently-live event code %s', async (code) => {
    const { service, usageEventRepository } = makeService([activeType(code)]);

    const result = await service.recordEvents([{ eventType: code }], 'org-1', 'user-1');

    expect(result).toEqual({ success: true, count: 1 });
    expect(usageEventRepository.save).toHaveBeenCalledTimes(1);
  });
});

describe('AnalyticsService.getMarketplaceActivityByOrg', () => {
  // Search_Tracking_Phase2_Implementation_Plan.md, decision B / test #2:
  // a chainable mock querybuilder per createQueryBuilder() call, since the
  // method builds two independent query builders (search, add_to_cart).
  const makeChainableQb = (rawResult: any[]) => {
    const calls: { method: string; args: any[] }[] = [];
    const qb: any = {};
    const chain = (method: string) => (...args: any[]) => {
      calls.push({ method, args });
      return qb;
    };
    qb.select = chain('select');
    qb.addSelect = chain('addSelect');
    qb.where = chain('where');
    qb.andWhere = chain('andWhere');
    qb.groupBy = chain('groupBy');
    qb.orderBy = chain('orderBy');
    qb.limit = chain('limit');
    qb.getRawMany = jest.fn().mockResolvedValue(rawResult);
    return { qb, calls };
  };

  it("scopes the topSearches query to screen_name = 'ProductsScreen' (regression guard for decision B)", async () => {
    const search = makeChainableQb([{ query: 'paracetamol', count: '5' }]);
    const products = makeChainableQb([]);
    const queryBuilders = [search.qb, products.qb];
    const usageEventRepository = {
      createQueryBuilder: jest.fn(() => queryBuilders.shift()),
    };
    const unused = {} as any;
    const service = new AnalyticsService(
      unused, unused, unused, unused, unused, unused, unused, unused,
      usageEventRepository as any, unused,
      unused, unused, unused, unused, unused, unused, unused, unused,
    );

    const result = await service.getMarketplaceActivityByOrg('org-1');

    const scoped = search.calls.find(
      (c) => c.method === 'andWhere' && c.args[0] === "u.screen_name = 'ProductsScreen'",
    );
    expect(scoped).toBeDefined();
    expect(result.topSearches).toEqual([{ query: 'paracetamol', count: 5 }]);
  });
});

describe('AnalyticsService.getFunnelAnalytics — marketplaceFunnel section', () => {
  // Tracking_Phase4_Question_Coverage_Recon.md question #3. Real-DB
  // verification (2026-09-23) already confirmed this exact query against
  // live data (raw psql and the real endpoint both returned
  // {searched:5, addedToCart:18, checkoutStarted:21, checkoutCompleted:12}
  // for the same window) -- this test guards the query construction and
  // response-shape mapping, not the SQL semantics themselves, which only
  // a real database can prove.
  const makeChainableQb = (rawOneResult: any) => {
    const calls: { method: string; args: any[] }[] = [];
    const qb: any = {};
    const chain = (method: string) => (...args: any[]) => {
      calls.push({ method, args });
      return qb;
    };
    qb.select = chain('select');
    qb.addSelect = chain('addSelect');
    qb.where = chain('where');
    qb.andWhere = chain('andWhere');
    qb.groupBy = chain('groupBy');
    qb.orderBy = chain('orderBy');
    qb.limit = chain('limit');
    qb.innerJoin = chain('innerJoin');
    qb.getRawMany = jest.fn().mockResolvedValue([]);
    qb.getRawOne = jest.fn().mockResolvedValue(rawOneResult);
    return { qb, calls };
  };

  it('builds the session-scoped CASE/COUNT DISTINCT query and maps the response correctly', async () => {
    const searchIntentQb = makeChainableQb(null);
    const marketplaceQb = makeChainableQb({
      searched: '5', addedToCart: '18', checkoutStarted: '21', checkoutCompleted: '12',
    });
    const timeToValueQb = makeChainableQb({ avgDays: '3.5' });
    const usageEventQueryBuilders = [searchIntentQb.qb, marketplaceQb.qb];
    const usageEventRepository = {
      createQueryBuilder: jest.fn(() => usageEventQueryBuilders.shift()),
      count: jest.fn().mockResolvedValue(0),
    };
    const ordersRepository = {
      createQueryBuilder: jest.fn(() => timeToValueQb.qb),
    };
    const unused = {} as any;
    const service = new AnalyticsService(
      ordersRepository as any, unused, unused, unused, unused, unused, unused, unused,
      usageEventRepository as any, unused,
      unused, unused, unused, unused, unused, unused, unused, unused,
    );

    const result = await service.getFunnelAnalytics(30);

    // Guards the actual query built for marketplaceFunnel -- the second
    // createQueryBuilder() call on usageEventRepository.
    const selectCall = marketplaceQb.calls.find((c) => c.method === 'select');
    expect(selectCall!.args[0]).toContain("event_type = 'search'");
    expect(selectCall!.args[0]).toContain("screen_name = 'ProductsScreen'");
    const addSelectCalls = marketplaceQb.calls.filter((c) => c.method === 'addSelect').map((c) => c.args[0]);
    expect(addSelectCalls.some((s: string) => s.includes("event_type = 'add_to_cart'"))).toBe(true);
    expect(addSelectCalls.some((s: string) => s.includes("event_type = 'checkout_started'"))).toBe(true);
    expect(addSelectCalls.some((s: string) => s.includes("event_type = 'checkout_completed'"))).toBe(true);

    expect(result.marketplaceFunnel).toEqual({
      searched: 5,
      addedToCart: 18,
      checkoutStarted: 21,
      checkoutCompleted: 12,
    });
  });

  it('defaults to all zeros when the query returns no rows (e.g. empty window)', async () => {
    const searchIntentQb = makeChainableQb(null);
    const marketplaceQb = makeChainableQb(undefined);
    const timeToValueQb = makeChainableQb(null);
    const usageEventQueryBuilders = [searchIntentQb.qb, marketplaceQb.qb];
    const usageEventRepository = {
      createQueryBuilder: jest.fn(() => usageEventQueryBuilders.shift()),
      count: jest.fn().mockResolvedValue(0),
    };
    const ordersRepository = { createQueryBuilder: jest.fn(() => timeToValueQb.qb) };
    const unused = {} as any;
    const service = new AnalyticsService(
      ordersRepository as any, unused, unused, unused, unused, unused, unused, unused,
      usageEventRepository as any, unused,
      unused, unused, unused, unused, unused, unused, unused, unused,
    );

    const result = await service.getFunnelAnalytics(30);

    expect(result.marketplaceFunnel).toEqual({
      searched: 0, addedToCart: 0, checkoutStarted: 0, checkoutCompleted: 0,
    });
  });
});
