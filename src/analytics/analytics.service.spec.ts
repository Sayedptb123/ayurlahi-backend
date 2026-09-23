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
    const bookingFunnelQb = makeChainableQb({
      created: '15', confirmed: '11', promotedToPatient: '0', checkedIn: '0', cancelled: '2',
    });
    const timeToValueQb = makeChainableQb({ avgDays: '3.5' });
    const usageEventQueryBuilders = [searchIntentQb.qb, marketplaceQb.qb, bookingFunnelQb.qb];
    const usageEventRepository = {
      createQueryBuilder: jest.fn(() => usageEventQueryBuilders.shift()),
      count: jest.fn().mockResolvedValue(0),
    };
    const ordersRepository = {
      createQueryBuilder: jest.fn(() => timeToValueQb.qb),
    };
    const statusSnapshotQb = makeChainableQb(null);
    statusSnapshotQb.qb.getRawMany = jest.fn().mockResolvedValue([
      { status: 'HELD', count: '8' },
      { status: 'FULFILLED', count: '2' },
      { status: 'CONFIRMED', count: '12' },
    ]);
    const roomBookingsRepository = { createQueryBuilder: jest.fn(() => statusSnapshotQb.qb) };
    const unused = {} as any;
    const service = new AnalyticsService(
      ordersRepository as any, unused, unused, unused, unused, unused, unused, unused,
      usageEventRepository as any, unused,
      unused, unused, unused, unused, unused, unused, unused,
      roomBookingsRepository as any, unused,
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

    // Guards bookingFunnel's query -- "created" is a raw COUNT, not
    // COUNT(DISTINCT ... bookingId) like the other stages, since
    // booking_created's trackEvent() fires before the mutation succeeds
    // and has no bookingId to attach (confirmed by tracing the real code).
    const bookingSelectCall = bookingFunnelQb.calls.find((c) => c.method === 'select');
    expect(bookingSelectCall!.args[0]).toContain("event_type = 'booking_created'");
    expect(bookingSelectCall!.args[0]).not.toContain('bookingId');
    const bookingAddSelectCalls = bookingFunnelQb.calls.filter((c) => c.method === 'addSelect').map((c) => c.args[0]);
    expect(bookingAddSelectCalls.some((s: string) => s.includes("booking_confirmed") && s.includes("DISTINCT"))).toBe(true);

    expect(result.bookingFunnel).toEqual({
      created: 15, confirmed: 11, promotedToPatient: 0, checkedIn: 0, cancelled: 2,
    });

    // Guards bookingStatusSnapshot -- straight from room_bookings.status,
    // not usage_events at all.
    expect(roomBookingsRepository.createQueryBuilder).toHaveBeenCalled();
    expect(result.bookingStatusSnapshot).toEqual({ HELD: 8, FULFILLED: 2, CONFIRMED: 12 });
  });

  it('defaults to all zeros / empty when the queries return no rows (e.g. empty window)', async () => {
    const searchIntentQb = makeChainableQb(null);
    const marketplaceQb = makeChainableQb(undefined);
    const bookingFunnelQb = makeChainableQb(undefined);
    const timeToValueQb = makeChainableQb(null);
    const usageEventQueryBuilders = [searchIntentQb.qb, marketplaceQb.qb, bookingFunnelQb.qb];
    const usageEventRepository = {
      createQueryBuilder: jest.fn(() => usageEventQueryBuilders.shift()),
      count: jest.fn().mockResolvedValue(0),
    };
    const ordersRepository = { createQueryBuilder: jest.fn(() => timeToValueQb.qb) };
    const statusSnapshotQb = makeChainableQb(null);
    statusSnapshotQb.qb.getRawMany = jest.fn().mockResolvedValue([]);
    const roomBookingsRepository = { createQueryBuilder: jest.fn(() => statusSnapshotQb.qb) };
    const unused = {} as any;
    const service = new AnalyticsService(
      ordersRepository as any, unused, unused, unused, unused, unused, unused, unused,
      usageEventRepository as any, unused,
      unused, unused, unused, unused, unused, unused, unused,
      roomBookingsRepository as any, unused,
    );

    const result = await service.getFunnelAnalytics(30);

    expect(result.marketplaceFunnel).toEqual({
      searched: 0, addedToCart: 0, checkoutStarted: 0, checkoutCompleted: 0,
    });
    expect(result.bookingFunnel).toEqual({
      created: 0, confirmed: 0, promotedToPatient: 0, checkedIn: 0, cancelled: 0,
    });
    expect(result.bookingStatusSnapshot).toEqual({});
  });
});

describe('AnalyticsService.getScreenToActionConversion', () => {
  // Tracking Phase 4/5 item 3. Real-DB verification (2026-09-23) already
  // confirmed the query against live data (Bookings -> booking_created,
  // 90 days: viewed=64, subsequentAction=5, matching hand-verified raw
  // SQL exactly) -- these tests guard the temporal-matching logic itself,
  // especially the window boundaries, which are easiest to get precisely
  // right against controlled synthetic timestamps.
  const makeService = (viewRows: any[], actionRows: any[]) => {
    const queues = [viewRows, actionRows];
    const usageEventRepository = {
      createQueryBuilder: jest.fn(() => {
        const rows = queues.shift();
        const qb: any = {};
        const chain = () => () => qb;
        qb.select = chain();
        qb.addSelect = chain();
        qb.where = chain();
        qb.andWhere = chain();
        qb.orderBy = chain();
        qb.getRawMany = jest.fn().mockResolvedValue(rows);
        return qb;
      }),
    };
    const unused = {} as any;
    const service = new AnalyticsService(
      unused, unused, unused, unused, unused, unused, unused, unused,
      usageEventRepository as any, unused,
      unused, unused, unused, unused, unused, unused, unused, unused,
    );
    return { service, usageEventRepository };
  };

  const iso = (offsetMinutesFromBase: number) =>
    new Date(new Date('2026-09-23T00:00:00.000Z').getTime() + offsetMinutesFromBase * 60000).toISOString();

  it('counts a session as converted only when the action falls strictly after the view, within the window', async () => {
    const { service } = makeService(
      [{ sessionId: 's1', occurredAt: iso(0) }, { sessionId: 's2', occurredAt: iso(0) }],
      [{ sessionId: 's1', occurredAt: iso(10) }], // s1: 10 min after view -- inside a 30-min window
    );
    const result = await service.getScreenToActionConversion('Bookings', 'booking_created', 90, 30);
    expect(result.viewed).toBe(2);
    expect(result.subsequentAction).toBe(1);
    expect(result.rate).toBe(50);
  });

  it('includes an action exactly at the window boundary (<=, not <)', async () => {
    const { service } = makeService(
      [{ sessionId: 's1', occurredAt: iso(0) }],
      [{ sessionId: 's1', occurredAt: iso(30) }], // exactly 30 min later, window = 30
    );
    const result = await service.getScreenToActionConversion('Bookings', 'booking_created', 90, 30);
    expect(result.subsequentAction).toBe(1);
  });

  it('excludes an action just past the window boundary', async () => {
    const { service } = makeService(
      [{ sessionId: 's1', occurredAt: iso(0) }],
      [{ sessionId: 's1', occurredAt: iso(30.01) }],
    );
    const result = await service.getScreenToActionConversion('Bookings', 'booking_created', 90, 30);
    expect(result.subsequentAction).toBe(0);
  });

  it('excludes an action that happened before the view (not "subsequent")', async () => {
    const { service } = makeService(
      [{ sessionId: 's1', occurredAt: iso(10) }],
      [{ sessionId: 's1', occurredAt: iso(5) }], // 5 min before the view
    );
    const result = await service.getScreenToActionConversion('Bookings', 'booking_created', 90, 30);
    expect(result.subsequentAction).toBe(0);
  });

  it('dedupes multiple views in the same session, using the earliest as the anchor', async () => {
    const { service } = makeService(
      [
        { sessionId: 's1', occurredAt: iso(0) },
        { sessionId: 's1', occurredAt: iso(60) }, // a second, later view in the same session
      ],
      [{ sessionId: 's1', occurredAt: iso(20) }], // 20 min after the EARLIEST view -- should match
    );
    const result = await service.getScreenToActionConversion('Bookings', 'booking_created', 90, 30);
    expect(result.viewed).toBe(1); // one session, not two view-rows
    expect(result.subsequentAction).toBe(1);
  });

  it('returns the "no sessions viewed" caveat and never queries actions when there are no views', async () => {
    const { service, usageEventRepository } = makeService([], []);
    const result = await service.getScreenToActionConversion('NoSuchScreen', 'booking_created', 90, 30);
    expect(result).toEqual({
      fromScreen: 'NoSuchScreen', toEventType: 'booking_created', days: 90, withinMinutes: 30,
      viewed: 0, subsequentAction: 0, rate: 0,
      caveat: 'No sessions viewed this screen in the given window.',
    });
    // Only the views query should have run -- the guard short-circuits
    // before ever building the actions query.
    expect(usageEventRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  it('includes the non-abandonment caveat whenever there is at least one viewed session', async () => {
    const { service } = makeService([{ sessionId: 's1', occurredAt: iso(0) }], []);
    const result = await service.getScreenToActionConversion('Bookings', 'booking_created', 90, 30);
    expect(result.subsequentAction).toBe(0);
    expect(result.caveat).toContain('is not proof of abandonment');
  });
});

describe('AnalyticsService.getFeatureUsageByOrg / getFeatureUsageByUser — meaningfulEvents', () => {
  // Tracking Phase 4/5 item 4. Real-DB verification (2026-09-23) already
  // confirmed the FILTER-clause query against live data (one real org:
  // totalEvents=2908, meaningfulEvents=1139) -- these tests guard the
  // query construction (the exact event types excluded) and that
  // totalEvents/topFeatures are unchanged, not the SQL semantics, which
  // only a real database can prove.
  const makeChainableQb = (rawManyResult: any[]) => {
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
    qb.addGroupBy = chain('addGroupBy');
    qb.orderBy = chain('orderBy');
    qb.limit = chain('limit');
    qb.getRawMany = jest.fn().mockResolvedValue(rawManyResult);
    return { qb, calls };
  };

  it('getFeatureUsageByOrg: excludes only app_open/app_foreground/app_background from meaningfulEvents, leaves totalEvents/topFeatures unchanged', async () => {
    const orgTotalsQb = makeChainableQb([{ orgId: 'org-1', totalEvents: '2908', meaningfulEvents: '1139' }]);
    const featuresQb = makeChainableQb([{ orgId: 'org-1', screenName: 'Dashboard', count: '384' }]);
    const orgsQb = makeChainableQb([{ id: 'org-1', name: 'PMS Ayurvedic Group' }]);
    const usageEventQueryBuilders = [orgTotalsQb.qb, featuresQb.qb];
    const usageEventRepository = { createQueryBuilder: jest.fn(() => usageEventQueryBuilders.shift()) };
    const organisationsRepository = { createQueryBuilder: jest.fn(() => orgsQb.qb) };
    const unused = {} as any;
    const service = new AnalyticsService(
      unused, unused, organisationsRepository as any, unused, unused, unused, unused, unused,
      usageEventRepository as any, unused,
      unused, unused, unused, unused, unused, unused, unused, unused, unused,
    );

    const result = await service.getFeatureUsageByOrg();

    const addSelectCalls = orgTotalsQb.calls.filter((c) => c.method === 'addSelect').map((c) => c.args[0]);
    const meaningfulSql = addSelectCalls.find((s: string) => s.includes('FILTER'));
    expect(meaningfulSql).toContain("event_type NOT IN ('app_open', 'app_foreground', 'app_background')");
    // Only the 3 lifecycle codes are excluded -- screen_view and every
    // business event stay in meaningfulEvents.
    expect(meaningfulSql).not.toContain('screen_view');
    expect(meaningfulSql).not.toContain('search');

    expect(result[0]).toEqual({
      organisationId: 'org-1',
      organisationName: 'PMS Ayurvedic Group',
      totalEvents: 2908,
      meaningfulEvents: 1139,
      topFeatures: [{ screenName: 'Dashboard', count: 384 }],
    });
  });

  it('getFeatureUsageByUser: same exclusion, response includes meaningfulEvents alongside the existing fields', async () => {
    const userTotalsQb = makeChainableQb([{ userId: 'u-1', totalEvents: '3300', meaningfulEvents: '964' }]);
    const featuresQb = makeChainableQb([{ userId: 'u-1', screenName: 'Dashboard', count: '273' }]);
    const usersQb = makeChainableQb([{ id: 'u-1', firstName: 'Pms', lastName: 'Muthukoya Thangal' }]);
    const roleQb = makeChainableQb([{ userId: 'u-1', role: 'OWNER', organisationId: 'org-1' }]);
    const usageEventQueryBuilders = [userTotalsQb.qb, featuresQb.qb];
    const usageEventRepository = { createQueryBuilder: jest.fn(() => usageEventQueryBuilders.shift()) };
    const usersRepository = { createQueryBuilder: jest.fn(() => usersQb.qb) };
    const organisationUsersRepository = { createQueryBuilder: jest.fn(() => roleQb.qb) };
    const unused = {} as any;
    const service = new AnalyticsService(
      unused, usersRepository as any, unused, unused, unused, unused, unused, unused,
      usageEventRepository as any, unused,
      unused, unused, unused, unused, unused, unused, unused, unused,
      organisationUsersRepository as any,
    );

    const result = await service.getFeatureUsageByUser();

    expect(result[0]).toEqual({
      userId: 'u-1',
      userName: 'Pms Muthukoya Thangal',
      role: 'OWNER',
      totalEvents: 3300,
      meaningfulEvents: 964,
      topFeatures: [{ screenName: 'Dashboard', count: 273 }],
    });
  });
});
