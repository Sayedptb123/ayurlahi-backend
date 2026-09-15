/**
 * T19 regression test (scope/Handoff_Blocker_Fixes_2026-09-16.md /
 * TRACKER.md T19): "Top Selling Medicines" units-sold must sum
 * item.packedQuantity (actual-supplied), not item.quantity (immutable
 * originally-requested amount), and must only count orders that have
 * actually reached PACKED/SHIPPED/DELIVERED.
 *
 * This seeds one throwaway Order+OrderItem per OrderStatus directly via the
 * real TypeORM repositories (bypassing the create-order API and the
 * multi-step status-transition workflow, neither of which is needed to
 * prove this query's SUM/GROUP BY/WHERE behavior), calls the real
 * AnalyticsService.getMarketplaceAnalytics() against the live DB, and
 * deletes the fixture rows in afterAll. Run locally:
 *   npm run test:e2e -- --testPathPattern=analytics-top-selling
 * Requires a running Postgres instance per test/critical-paths.e2e-spec.ts.
 *
 * Quantities are scaled up (1,000,000 requested / 600,000 packed) purely so
 * these fixtures deterministically rank in the query's top-10-by-volume
 * regardless of how much real product volume already exists in whatever DB
 * this runs against -- the 60% packed/requested ratio itself mirrors the
 * "requested 10, packed 6" example from the bug report.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { Order, OrderStatus, OrderSource } from '../src/orders/entities/order.entity';
import { OrderItem } from '../src/orders/entities/order-item.entity';

// Real org (CNS Ayurvedic Hospital) -- orders.organisation_id has a real FK
// constraint to organisations(id), so this must be a row that actually
// exists. order_items.product_id/manufacturer_id have no FK constraint
// (plain-FK-by-convention, same as elsewhere in this codebase), so those can
// be arbitrary UUIDs.
const CNS_ORG_ID = '6e82bc9e-4dfb-4192-8cf8-308e0672e20d';
const RUN_ID = `${Date.now()}`;

const REQUESTED = 1_000_000;
const PACKED = 600_000;
const UNIT_PRICE = 10;

// Every reachable OrderStatus. Only PACKED/SHIPPED/DELIVERED should ever
// contribute to "Top Selling Medicines" after the T19 fix.
const ALL_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.RETURNED,
];
const QUALIFYING_STATUSES = new Set([OrderStatus.PACKED, OrderStatus.SHIPPED, OrderStatus.DELIVERED]);

const productNameFor = (status: OrderStatus) => `T19-TEST-${status.toUpperCase()}-${RUN_ID}`;

describe('T19 — Top Selling Medicines: packedQuantity + status filter (e2e)', () => {
  let app: INestApplication;
  let analyticsService: AnalyticsService;
  let orderRepo: Repository<Order>;
  let orderItemRepo: Repository<OrderItem>;
  const createdOrderIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    analyticsService = moduleFixture.get(AnalyticsService);
    orderRepo = moduleFixture.get(getRepositoryToken(Order));
    orderItemRepo = moduleFixture.get(getRepositoryToken(OrderItem));

    // Seed one Order + one OrderItem per status. packedQuantity is 0 for
    // every non-qualifying status (nothing has actually been packed yet, the
    // realistic value for pending/confirmed/processing/cancelled/returned)
    // and PACKED for the three qualifying ones.
    for (const status of ALL_STATUSES) {
      const packedQuantity = QUALIFYING_STATUSES.has(status) ? PACKED : 0;
      const totalAmount = packedQuantity > 0 ? packedQuantity * UNIT_PRICE : REQUESTED * UNIT_PRICE;

      const order = await orderRepo.save(
        orderRepo.create({
          organisationId: CNS_ORG_ID,
          orderNumber: `T19-${status}-${RUN_ID}`.slice(0, 50),
          status,
          source: OrderSource.WEB,
          subtotal: totalAmount,
          totalAmount,
        }),
      );
      createdOrderIds.push(order.id);

      await orderItemRepo.save(
        orderItemRepo.create({
          orderId: order.id,
          productId: '00000000-0000-0000-0000-000000000001',
          manufacturerId: '00000000-0000-0000-0000-000000000002',
          productSku: `T19-SKU-${RUN_ID}`,
          productName: productNameFor(status),
          quantity: REQUESTED,
          reservedQuantity: REQUESTED,
          unitPrice: UNIT_PRICE,
          gstRate: 0,
          subtotal: totalAmount,
          gstAmount: 0,
          totalAmount,
          commissionAmount: 0,
          packedQuantity,
        }),
      );
    }
  });

  afterAll(async () => {
    // order_items.order_id has ON DELETE CASCADE, so deleting the orders
    // alone removes both. Hard delete is fine here -- these are synthetic
    // fixture rows created and destroyed entirely within this test run, not
    // real financial records.
    if (createdOrderIds.length > 0) {
      await orderRepo.delete(createdOrderIds);
    }
    await app.close();
  });

  it('units sold = packedQuantity (not requested quantity) for a packed order', async () => {
    const { topMedicines } = await analyticsService.getMarketplaceAnalytics(30);
    const row = topMedicines.find((m: any) => m.name === productNameFor(OrderStatus.PACKED));
    expect(row).toBeDefined();
    expect(row!.quantity).toBe(PACKED);
    expect(row!.quantity).not.toBe(REQUESTED);
  });

  it.each([OrderStatus.SHIPPED, OrderStatus.DELIVERED])(
    'units sold = packedQuantity for a %s order too',
    async (status) => {
      const { topMedicines } = await analyticsService.getMarketplaceAnalytics(30);
      const row = topMedicines.find((m: any) => m.name === productNameFor(status));
      expect(row).toBeDefined();
      expect(row!.quantity).toBe(PACKED);
    },
  );

  it.each([
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.CANCELLED,
    OrderStatus.RETURNED,
  ])('a %s order contributes zero units sold (excluded entirely)', async (status) => {
    const { topMedicines } = await analyticsService.getMarketplaceAnalytics(30);
    const row = topMedicines.find((m: any) => m.name === productNameFor(status));
    expect(row).toBeUndefined();
  });

  it('revenue (totalAmount sum) is unaffected by the T19 fix -- still correct for a packed order', async () => {
    const { topMedicines } = await analyticsService.getMarketplaceAnalytics(30);
    const row = topMedicines.find((m: any) => m.name === productNameFor(OrderStatus.PACKED));
    expect(row).toBeDefined();
    expect(row!.revenue).toBe(PACKED * UNIT_PRICE);
  });
});
