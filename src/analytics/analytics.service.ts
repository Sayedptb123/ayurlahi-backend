import { Injectable, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { BranchScope, BranchVisibilityService } from '../branch-visibility/branch-visibility.service';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { Dispute, DisputeStatus } from '../disputes/entities/dispute.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { PatientBill } from '../patient-billing/entities/patient-bill.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { RoleUtils } from '../common/utils/role.utils';
import { UsageEvent } from './entities/usage-event.entity';
import { UsageEventType } from './entities/usage-event-type.entity';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchase-orders/entities/purchase-order-item.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Admission } from '../retreat/entities/admission.entity';
import { Room } from '../retreat/entities/room.entity';
import { RoomBooking } from '../retreat/entities/room-booking.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';

// Branch scoping Phase 9 (scope/Branch_Scoping_Remediation_Plan_2026-09-24.md):
// every clinic analytic aggregates only the caller's branches, then the
// switcher's selection. Two scopes, because an organisation's patient and
// inventory visibility are independent decisions (ADR-005):
//   patient   — patients, appointments, bills, admissions, rooms, expenses
//   inventory — marketplace orders, purchase orders, branch stock, movements
// Omitted (Ayurlahi-team / base-wide callers) = no branch filter.
export interface AnalyticsBranchCtx {
  patient: BranchScope;
  inventory: BranchScope;
  branchId?: string;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Organisation)
    private organisationsRepository: Repository<Organisation>,
    @InjectRepository(Dispute)
    private disputesRepository: Repository<Dispute>,
    @InjectRepository(Patient)
    private patientsRepository: Repository<Patient>,
    @InjectRepository(Appointment)
    private appointmentsRepository: Repository<Appointment>,
    @InjectRepository(PatientBill)
    private billsRepository: Repository<PatientBill>,
    @InjectRepository(Expense)
    private expensesRepository: Repository<Expense>,
    @InjectRepository(UsageEvent)
    private usageEventRepository: Repository<UsageEvent>,
    @InjectRepository(UsageEventType)
    private usageEventTypeRepository: Repository<UsageEventType>,
    @InjectRepository(PurchaseOrder)
    private purchaseOrdersRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private purchaseOrderItemsRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(InventoryItem)
    private inventoryItemsRepository: Repository<InventoryItem>,
    @InjectRepository(StockMovement)
    private stockMovementsRepository: Repository<StockMovement>,
    @InjectRepository(Admission)
    private admissionsRepository: Repository<Admission>,
    @InjectRepository(Room)
    private roomsRepository: Repository<Room>,
    @InjectRepository(RoomBooking)
    private roomBookingsRepository: Repository<RoomBooking>,
    @InjectRepository(OrganisationUser)
    private organisationUsersRepository: Repository<OrganisationUser>,
    private branchVisibilityService: BranchVisibilityService,
  ) { }

  // Scope + switcher on a query builder (a branch outside scope matches nothing).
  private scopeQb<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, column: string, scope: BranchScope | undefined, branchId?: string) {
    if (!scope) return qb;
    this.branchVisibilityService.applyBranchScope(qb, column, scope);
    this.branchVisibilityService.narrowToSelectedBranch(qb, column, branchId, scope);
    return qb;
  }

  // The same rule for raw SQL: returns ' AND …' and pushes its parameters.
  private sqlBranch(column: string, scope: BranchScope | undefined, branchId: string | undefined, params: any[]): string {
    if (!scope) return '';
    // Decide "matches nothing" BEFORE pushing any parameter: an unused bound
    // parameter makes Postgres fail the whole query.
    if (scope.kind === 'branches' && scope.ids.length === 0) return ' AND 1 = 0';
    if (branchId && scope.kind === 'branches' && !scope.ids.includes(branchId)) return ' AND 1 = 0';
    let clause = '';
    if (scope.kind === 'branches') {
      params.push(scope.ids);
      clause += ` AND ${column} = ANY($${params.length}::uuid[])`;
    }
    if (branchId) {
      params.push(branchId);
      clause += ` AND ${column} = $${params.length}::uuid`;
    }
    return clause;
  }

  // Date range as bound parameters (never string-built SQL).
  private dateRange<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, column: string, startDate?: string, endDate?: string) {
    if (startDate) qb.andWhere(`${column} >= :rangeStart`, { rangeStart: startDate });
    if (endDate) qb.andWhere(`${column} <= :rangeEnd`, { rangeEnd: endDate });
    return qb;
  }

  async getDashboardStats(
    userRole: string,
    startDate?: string,
    endDate?: string,
  ) {
    if (!RoleUtils.isAdminOrSupport(userRole)) {
      throw new ForbiddenException(
        'You do not have permission to view analytics',
      );
    }

    try {
      const activeClinics = await this.organisationsRepository.count({
        where: { type: 'CLINIC', deletedAt: IsNull() },
      });

      const activeManufacturers = await this.organisationsRepository.count({
        where: { type: 'MANUFACTURER', deletedAt: IsNull() },
      });

      let pendingDisputes = 0;
      try {
        pendingDisputes = await this.disputesRepository.count({
          where: { status: DisputeStatus.OPEN, deletedAt: IsNull() },
        });
      } catch (error) {
        if (error.message && error.message.includes('does not exist')) {
          pendingDisputes = 0;
        } else {
          throw error;
        }
      }

      return {
        totalRevenue: 0,
        totalOrders: 0,
        totalCommissions: 0,
        activeClinics,
        activeManufacturers,
        pendingDisputes,
        ordersByStatus: {},
        revenueByPeriod: [],
      };
    } catch (error) {
      console.error('[Analytics Service] Error in getDashboardStats:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  async getClinicDashboard(
    organisationId: string,
    startDate?: string,
    endDate?: string,
    ctx?: AnalyticsBranchCtx,
  ) {
    // Every figure is patient-side data, so each query takes the patient scope.
    // Dates are bound parameters: the previous version string-built them into
    // the SQL from the query string (SQL injection).
    const scoped = <T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, column: string) =>
      this.scopeQb(qb, column, ctx?.patient, ctx?.branchId);

    // Total patients
    const totalPatients = await scoped(
      this.patientsRepository
        .createQueryBuilder('p')
        .where('p.organisationId = :organisationId', { organisationId })
        .andWhere('p.deletedAt IS NULL'),
      'p.branchId',
    ).getCount();

    // Total appointments
    const apptQb = scoped(
      this.appointmentsRepository
        .createQueryBuilder('a')
        .where('a.organisationId = :organisationId', { organisationId })
        .andWhere('a.deletedAt IS NULL'),
      'a.branchId',
    );
    this.dateRange(apptQb, 'a.appointmentDate', startDate, endDate);
    const totalAppointments = await apptQb.getCount();

    // Appointments by status
    const apptByStatusQb = scoped(
      this.appointmentsRepository
        .createQueryBuilder('a')
        .select('a.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('a.organisationId = :organisationId', { organisationId })
        .andWhere('a.deletedAt IS NULL')
        .groupBy('a.status'),
      'a.branchId',
    );
    this.dateRange(apptByStatusQb, 'a.appointmentDate', startDate, endDate);
    const apptByStatusRaw = await apptByStatusQb.getRawMany();
    const appointmentsByStatus = apptByStatusRaw.map((r) => ({
      status: r.status,
      count: parseInt(r.count, 10),
    }));

    // Revenue from paid/partial bills
    const revenueQb = scoped(
      this.billsRepository
        .createQueryBuilder('b')
        .select('COALESCE(SUM(b.paidAmount), 0)', 'revenue')
        .where('b.organisationId = :organisationId', { organisationId })
        .andWhere('b.deletedAt IS NULL')
        .andWhere("b.status IN ('paid', 'partial')"),
      'b.branchId',
    );
    this.dateRange(revenueQb, 'b.billDate', startDate, endDate);
    const revenueResult = await revenueQb.getRawOne();
    const totalRevenue = parseFloat(revenueResult?.revenue ?? '0');

    // Total expenses
    const expQb = scoped(
      this.expensesRepository
        .createQueryBuilder('e')
        .select('COALESCE(SUM(e.amount), 0)', 'total')
        .where('e.organisationId = :organisationId', { organisationId })
        .andWhere('e.deletedAt IS NULL'),
      'e.branchId',
    );
    this.dateRange(expQb, 'e.expenseDate', startDate, endDate);
    const expResult = await expQb.getRawOne();
    const totalExpenses = parseFloat(expResult?.total ?? '0');

    // Revenue by month (last 12 months or within date range)
    const revenueByMonthQb = scoped(
      this.billsRepository
        .createQueryBuilder('b')
        .select("TO_CHAR(b.billDate, 'Mon YYYY')", 'month')
        .addSelect("DATE_TRUNC('month', b.billDate)", 'monthStart')
        .addSelect('COALESCE(SUM(b.paidAmount), 0)', 'amount')
        .where('b.organisationId = :organisationId', { organisationId })
        .andWhere('b.deletedAt IS NULL')
        .andWhere("b.status IN ('paid', 'partial')")
        .groupBy("TO_CHAR(b.billDate, 'Mon YYYY'), DATE_TRUNC('month', b.billDate)")
        .orderBy("DATE_TRUNC('month', b.billDate)", 'ASC')
        .limit(12),
      'b.branchId',
    );
    this.dateRange(revenueByMonthQb, 'b.billDate', startDate, endDate);
    const revenueByMonthRaw = await revenueByMonthQb.getRawMany();
    const revenueByMonth = revenueByMonthRaw.map((r) => ({
      month: r.month,
      amount: parseFloat(r.amount),
    }));

    return {
      totalPatients,
      totalAppointments,
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      appointmentsByStatus,
      revenueByMonth,
    };
  }

  /**
   * Phase 24B.1 — Procurement leakage (single clinic).
   * "On-platform" medicine spend = marketplace `orders` (real ones: not
   * cancelled/returned). "Off-platform" = `purchase_orders` recorded against the
   * clinic's own suppliers (real ones: not draft/cancelled). The capture rate
   * = how much of total medicine spend flows through our marketplace; its
   * inverse is the leakage to distributors. Decimal sums come back as strings —
   * parseFloat (hard rule #5).
   */
  async getProcurementAnalytics(
    organisationId: string,
    startDate?: string,
    endDate?: string,
    ctx?: AnalyticsBranchCtx,
  ) {
    // On-platform (marketplace orders)
    const onQb = this.ordersRepository
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.totalAmount), 0)', 'spend')
      .addSelect('COALESCE(SUM(o.platformFee), 0)', 'platformRevenue')
      .addSelect('COUNT(*)', 'cnt')
      .where('o.organisationId = :organisationId', { organisationId })
      .andWhere('o.deletedAt IS NULL')
      .andWhere("o.status NOT IN ('cancelled', 'returned')");
    if (startDate) onQb.andWhere('o.createdAt >= :startDate', { startDate });
    if (endDate) onQb.andWhere('o.createdAt <= :endDate', { endDate });
    this.scopeQb(onQb, 'o.branchId', ctx?.inventory, ctx?.branchId);
    const onRaw = await onQb.getRawOne();

    // Off-platform (purchase orders to the clinic's own suppliers)
    const offQb = this.purchaseOrdersRepository
      .createQueryBuilder('po')
      .select('COALESCE(SUM(po.totalAmount), 0)', 'spend')
      .addSelect('COUNT(*)', 'cnt')
      .where('po.organisationId = :organisationId', { organisationId })
      .andWhere('po.deletedAt IS NULL')
      .andWhere("po.status NOT IN ('draft', 'cancelled')");
    if (startDate) offQb.andWhere('po.orderDate >= :startDate', { startDate });
    if (endDate) offQb.andWhere('po.orderDate <= :endDate', { endDate });
    this.scopeQb(offQb, 'po.branchId', ctx?.inventory, ctx?.branchId);
    const offRaw = await offQb.getRawOne();

    const onPlatformSpend = parseFloat(onRaw?.spend ?? '0');
    const offPlatformSpend = parseFloat(offRaw?.spend ?? '0');
    const platformRevenue = parseFloat(onRaw?.platformRevenue ?? '0');
    const totalMedicineSpend = onPlatformSpend + offPlatformSpend;
    const pct = (n: number) =>
      totalMedicineSpend > 0
        ? Math.round((n / totalMedicineSpend) * 1000) / 10
        : 0;

    // Phase 24B.2 — breakdowns
    const [bySupplier, byMedicine, unmetDemand] = await Promise.all([
      this.spendBySupplier(organisationId, startDate, endDate, ctx),
      this.spendByMedicine(organisationId, startDate, endDate, ctx),
      this.unmetDemandForClinic(organisationId, ctx),
    ]);

    return {
      range: { startDate: startDate ?? null, endDate: endDate ?? null },
      onPlatformSpend,
      offPlatformSpend,
      totalMedicineSpend,
      captureRatePct: pct(onPlatformSpend),
      leakageRatePct: pct(offPlatformSpend),
      platformRevenue,
      onPlatformOrders: parseInt(onRaw?.cnt ?? '0', 10),
      offPlatformPurchases: parseInt(offRaw?.cnt ?? '0', 10),
      bySupplier,
      byMedicine,
      unmetDemand,
    };
  }

  /**
   * Phase 24B.1 — Procurement leakage, base-wide (AYURLAHI_TEAM only).
   * Totals across all clinics + a per-clinic breakdown sorted by off-platform
   * spend — i.e. the biggest leaks are the biggest conversion opportunities.
   */
  async getProcurementAnalyticsBase(startDate?: string, endDate?: string) {
    const onQb = this.ordersRepository
      .createQueryBuilder('o')
      .select('o.organisationId', 'orgId')
      .addSelect('COALESCE(SUM(o.totalAmount), 0)', 'spend')
      .addSelect('COALESCE(SUM(o.platformFee), 0)', 'platformRevenue')
      .where('o.deletedAt IS NULL')
      .andWhere("o.status NOT IN ('cancelled', 'returned')")
      .groupBy('o.organisationId');
    if (startDate) onQb.andWhere('o.createdAt >= :startDate', { startDate });
    if (endDate) onQb.andWhere('o.createdAt <= :endDate', { endDate });
    const onRows = await onQb.getRawMany();

    const offQb = this.purchaseOrdersRepository
      .createQueryBuilder('po')
      .select('po.organisationId', 'orgId')
      .addSelect('COALESCE(SUM(po.totalAmount), 0)', 'spend')
      .where('po.deletedAt IS NULL')
      .andWhere("po.status NOT IN ('draft', 'cancelled')")
      .groupBy('po.organisationId');
    if (startDate) offQb.andWhere('po.orderDate >= :startDate', { startDate });
    if (endDate) offQb.andWhere('po.orderDate <= :endDate', { endDate });
    const offRows = await offQb.getRawMany();

    // Merge per org
    const byOrg = new Map<
      string,
      { onPlatformSpend: number; offPlatformSpend: number; platformRevenue: number }
    >();
    const ensure = (orgId: string) => {
      if (!byOrg.has(orgId))
        byOrg.set(orgId, {
          onPlatformSpend: 0,
          offPlatformSpend: 0,
          platformRevenue: 0,
        });
      return byOrg.get(orgId)!;
    };
    for (const r of onRows) {
      const e = ensure(r.orgId);
      e.onPlatformSpend = parseFloat(r.spend ?? '0');
      e.platformRevenue = parseFloat(r.platformRevenue ?? '0');
    }
    for (const r of offRows) {
      ensure(r.orgId).offPlatformSpend = parseFloat(r.spend ?? '0');
    }

    // Resolve org names
    const orgIds = [...byOrg.keys()];
    const orgs = orgIds.length
      ? await this.organisationsRepository
          .createQueryBuilder('org')
          .select(['org.id AS id', 'org.name AS name'])
          .where('org.id IN (:...orgIds)', { orgIds })
          .getRawMany()
      : [];
    const nameById = new Map(orgs.map((o) => [o.id, o.name]));

    const perClinic = orgIds
      .map((orgId) => {
        const e = byOrg.get(orgId)!;
        const total = e.onPlatformSpend + e.offPlatformSpend;
        return {
          organisationId: orgId,
          name: nameById.get(orgId) ?? null,
          onPlatformSpend: e.onPlatformSpend,
          offPlatformSpend: e.offPlatformSpend,
          totalMedicineSpend: total,
          captureRatePct:
            total > 0
              ? Math.round((e.onPlatformSpend / total) * 1000) / 10
              : 0,
          platformRevenue: e.platformRevenue,
        };
      })
      .sort((a, b) => b.offPlatformSpend - a.offPlatformSpend);

    const onPlatformSpend = perClinic.reduce((s, c) => s + c.onPlatformSpend, 0);
    const offPlatformSpend = perClinic.reduce((s, c) => s + c.offPlatformSpend, 0);
    const platformRevenue = perClinic.reduce((s, c) => s + c.platformRevenue, 0);
    const totalMedicineSpend = onPlatformSpend + offPlatformSpend;
    const pct = (n: number) =>
      totalMedicineSpend > 0
        ? Math.round((n / totalMedicineSpend) * 1000) / 10
        : 0;

    // Phase 24B.2 — base-wide demand + sourcing gaps
    const [byMedicine, topUnmetDemand] = await Promise.all([
      this.spendByMedicine(null, startDate, endDate),
      this.unmetDemandBase(),
    ]);

    return {
      range: { startDate: startDate ?? null, endDate: endDate ?? null },
      onPlatformSpend,
      offPlatformSpend,
      totalMedicineSpend,
      captureRatePct: pct(onPlatformSpend),
      leakageRatePct: pct(offPlatformSpend),
      platformRevenue,
      clinicsWithSpend: perClinic.length,
      perClinic,
      byMedicine,
      topUnmetDemand,
    };
  }

  /** Phase 24B.2 — off-platform spend grouped by supplier (one clinic). */
  private async spendBySupplier(
    organisationId: string,
    startDate?: string,
    endDate?: string,
    ctx?: AnalyticsBranchCtx,
  ) {
    const qb = this.purchaseOrdersRepository
      .createQueryBuilder('po')
      .leftJoin(Supplier, 's', 's.id = po.supplierId')
      .select('po.supplierId', 'supplierId')
      .addSelect('MAX(s.name)', 'name')
      .addSelect('COALESCE(SUM(po.totalAmount), 0)', 'spend')
      .addSelect('COUNT(*)', 'poCount')
      .where('po.organisationId = :organisationId', { organisationId })
      .andWhere('po.deletedAt IS NULL')
      .andWhere("po.status NOT IN ('draft', 'cancelled')")
      .groupBy('po.supplierId');
    if (startDate) qb.andWhere('po.orderDate >= :startDate', { startDate });
    if (endDate) qb.andWhere('po.orderDate <= :endDate', { endDate });
    this.scopeQb(qb, 'po.branchId', ctx?.inventory, ctx?.branchId);
    const rows = await qb.getRawMany();
    return rows
      .map((r) => ({
        supplierId: r.supplierId,
        name: r.name ?? 'Unknown',
        spend: parseFloat(r.spend ?? '0'),
        poCount: parseInt(r.poCount ?? '0', 10),
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 20);
  }

  /**
   * Phase 24B.2 — top medicines by combined spend (off-platform
   * purchase_order_items + on-platform order_items), matched on name. Pass
   * organisationId = null for base-wide. Aggregated demand = sourcing leverage.
   */
  private async spendByMedicine(
    organisationId: string | null,
    startDate?: string,
    endDate?: string,
    ctx?: AnalyticsBranchCtx,
  ) {
    const offQb = this.purchaseOrderItemsRepository
      .createQueryBuilder('poi')
      .leftJoin('poi.purchaseOrder', 'po')
      .select('LOWER(TRIM(poi.itemName))', 'key')
      .addSelect('MAX(poi.itemName)', 'name')
      .addSelect('COALESCE(SUM(poi.totalPrice), 0)', 'spend')
      .addSelect('COALESCE(SUM(poi.quantity), 0)', 'qty')
      .where('po.deletedAt IS NULL')
      .andWhere("po.status NOT IN ('draft', 'cancelled')")
      .groupBy('LOWER(TRIM(poi.itemName))');
    if (organisationId)
      offQb.andWhere('po.organisationId = :organisationId', { organisationId });
    if (startDate) offQb.andWhere('po.orderDate >= :startDate', { startDate });
    if (endDate) offQb.andWhere('po.orderDate <= :endDate', { endDate });
    this.scopeQb(offQb, 'po.branchId', ctx?.inventory, ctx?.branchId);
    const offRows = await offQb.getRawMany();

    const onQb = this.orderItemsRepository
      .createQueryBuilder('oi')
      .leftJoin('oi.order', 'o')
      .select('LOWER(TRIM(oi.productName))', 'key')
      .addSelect('MAX(oi.productName)', 'name')
      .addSelect('COALESCE(SUM(oi.totalAmount), 0)', 'spend')
      .addSelect('COALESCE(SUM(oi.quantity), 0)', 'qty')
      .where('o.deletedAt IS NULL')
      .andWhere("o.status NOT IN ('cancelled', 'returned')")
      .groupBy('LOWER(TRIM(oi.productName))');
    if (organisationId)
      onQb.andWhere('o.organisationId = :organisationId', { organisationId });
    if (startDate) onQb.andWhere('o.createdAt >= :startDate', { startDate });
    if (endDate) onQb.andWhere('o.createdAt <= :endDate', { endDate });
    this.scopeQb(onQb, 'o.branchId', ctx?.inventory, ctx?.branchId);
    const onRows = await onQb.getRawMany();

    const byKey = new Map<
      string,
      { name: string; offSpend: number; onSpend: number; qty: number }
    >();
    const ensure = (key: string, name: string) => {
      if (!byKey.has(key))
        byKey.set(key, { name, offSpend: 0, onSpend: 0, qty: 0 });
      return byKey.get(key)!;
    };
    for (const r of offRows) {
      const e = ensure(r.key, r.name);
      e.offSpend += parseFloat(r.spend ?? '0');
      e.qty += parseInt(r.qty ?? '0', 10);
    }
    for (const r of onRows) {
      const e = ensure(r.key, r.name);
      e.onSpend += parseFloat(r.spend ?? '0');
      e.qty += parseInt(r.qty ?? '0', 10);
    }
    return [...byKey.values()]
      .map((e) => ({
        name: e.name,
        offPlatformSpend: e.offSpend,
        onPlatformSpend: e.onSpend,
        totalSpend: e.offSpend + e.onSpend,
        qty: e.qty,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 15);
  }

  /**
   * Phase 24B.2 — a clinic's own "unmet demand": low-stock inventory items that
   * are NOT linked to a marketplace product (so "Order Now" can't help them yet).
   */
  // Unlinked items at or below their reorder level — from BRANCH stock
  // (ADR-005): inventory_items stopped being written at the Step 3 cutover.
  private async unmetDemandForClinic(organisationId: string, ctx?: AnalyticsBranchCtx) {
    const params: any[] = [organisationId];
    const branch = this.sqlBranch('bs.branch_id', ctx?.inventory, ctx?.branchId, params);
    const rows = await this.inventoryItemsRepository.manager.query(
      `SELECT m.name AS name, bs.current_stock AS "currentStock", bs.min_stock_level AS "minStockLevel"
         FROM inventory_branch_stock bs
         JOIN inventory_item_masters m ON m.id = bs.item_master_id AND m.deleted_at IS NULL
        WHERE bs.organisation_id = $1 AND bs.deleted_at IS NULL
          AND m.product_id IS NULL
          AND bs.current_stock <= bs.min_stock_level${branch}
        ORDER BY m.name ASC
        LIMIT 50`,
      params,
    );
    return rows.map((r: any) => ({
      name: r.name,
      currentStock: parseInt(r.currentStock ?? '0', 10),
      minStockLevel: parseInt(r.minStockLevel ?? '0', 10),
    }));
  }

  /**
   * Phase 24B.2 — base-wide unmet demand: unlinked low-stock items across all
   * clinics, grouped by name = catalog gaps to source (the products clinics need
   * that aren't on the marketplace).
   */
  private async unmetDemandBase() {
    const rows = await this.inventoryItemsRepository
      .createQueryBuilder('item')
      .select('LOWER(TRIM(item.name))', 'key')
      .addSelect('MAX(item.name)', 'name')
      .addSelect('COUNT(DISTINCT item.organisationId)', 'clinics')
      .where('item.deletedAt IS NULL')
      .andWhere('item.productId IS NULL')
      .andWhere('item.currentStock <= item.minStockLevel')
      .groupBy('LOWER(TRIM(item.name))')
      .getRawMany();
    return rows
      .map((r) => ({
        name: r.name,
        clinics: parseInt(r.clinics ?? '0', 10),
      }))
      .sort((a, b) => b.clinics - a.clinics)
      .slice(0, 20);
  }

  /**
   * Phase 24B.4 — inventory health for one clinic. Summary + stockout frequency
   * and cost-price trend from the `stock_movements` ledger (24C.1). Turnover /
   * days-of-cover need consumption-OUT events, which don't exist yet — omitted.
   */
  // Branch scoping Phase 9: stock health is read from BRANCH stock
  // (inventory_branch_stock + inventory_item_masters, ADR-005) under the
  // caller's inventory scope + switcher. It used to read inventory_items,
  // which stopped being written at the ADR-005 Step 3 cutover, so these
  // figures had gone stale. "items" counts stock lines (an item held at two
  // branches is two lines) — the unit branch-scoped stock is managed in.
  async getInventoryHealth(organisationId: string, ctx?: AnalyticsBranchCtx) {
    const m = this.inventoryItemsRepository.manager;
    const sp: any[] = [organisationId];
    const stockBranch = this.sqlBranch('bs.branch_id', ctx?.inventory, ctx?.branchId, sp);
    const [summaryRaw] = await m.query(
      `SELECT COUNT(*) AS items,
              COUNT(*) FILTER (WHERE bs.current_stock <= bs.min_stock_level) AS low,
              COUNT(*) FILTER (WHERE bs.current_stock = 0) AS "outOfStock",
              COUNT(im.product_id) AS linked,
              COUNT(*) FILTER (WHERE im.product_id IS NOT NULL AND bs.current_stock <= bs.min_stock_level) AS "linkedLow",
              COALESCE(SUM(bs.current_stock * COALESCE(im.cost_price, im.unit_price, 0)), 0) AS "stockValue",
              COUNT(*) FILTER (WHERE bs.expiry_date IS NOT NULL AND bs.expiry_date < CURRENT_DATE AND bs.current_stock > 0) AS expired,
              COUNT(*) FILTER (WHERE bs.expiry_date IS NOT NULL AND bs.expiry_date >= CURRENT_DATE AND bs.expiry_date < CURRENT_DATE + INTERVAL '30 days' AND bs.current_stock > 0) AS "expiringSoon",
              COALESCE(SUM(bs.current_stock * COALESCE(im.cost_price, im.unit_price, 0)) FILTER (WHERE bs.expiry_date IS NOT NULL AND bs.expiry_date < CURRENT_DATE), 0) AS "expiredValue"
         FROM inventory_branch_stock bs
         JOIN inventory_item_masters im ON im.id = bs.item_master_id AND im.deleted_at IS NULL
        WHERE bs.organisation_id = $1 AND bs.deleted_at IS NULL${stockBranch}`,
      sp,
    );

    const items = parseInt(summaryRaw?.items ?? '0', 10);
    const linked = parseInt(summaryRaw?.linked ?? '0', 10);
    const linkedLow = parseInt(summaryRaw?.linkedLow ?? '0', 10);

    // Movements: keyed by stock line (inventory_branch_stock_id), falling back
    // to the legacy inventory_item_id for movements recorded before the cutover;
    // scoped by the movement's own branch.
    const movement = (extra: string) => {
      const params: any[] = [organisationId];
      const branch = this.sqlBranch('sm.branch_id', ctx?.inventory, ctx?.branchId, params);
      return { sql: `sm.organisation_id = $1 AND sm.deleted_at IS NULL${branch}${extra}`, params };
    };
    const key = `COALESCE(sm.inventory_branch_stock_id::text, sm.inventory_item_id::text)`;
    const nameExpr = `COALESCE(MAX(im.name), MAX(ii.name), 'Unknown')`;
    const joins = `LEFT JOIN inventory_branch_stock bs ON bs.id = sm.inventory_branch_stock_id
                   LEFT JOIN inventory_item_masters im ON im.id = bs.item_master_id
                   LEFT JOIN inventory_items ii ON ii.id = sm.inventory_item_id`;

    // Phase 24B.5 — reorder coverage: stock lines reordered on-platform.
    const reordered = movement(` AND sm.movement_type = 'order_delivery'`);
    const [reorderedRaw] = await m.query(
      `SELECT COUNT(DISTINCT ${key}) AS cnt FROM stock_movements sm WHERE ${reordered.sql}`,
      reordered.params,
    );
    const reorderedItems = parseInt(reorderedRaw?.cnt ?? '0', 10);

    // Stockout frequency from the ledger (times balance hit 0).
    const so = movement(` AND sm.balance_after = 0`);
    const stockoutRows = await m.query(
      `SELECT ${nameExpr} AS name, COUNT(*) AS stockouts
         FROM stock_movements sm ${joins}
        WHERE ${so.sql}
        GROUP BY ${key}`,
      so.params,
    );
    const stockouts = stockoutRows
      .map((r: any) => ({ name: r.name, stockouts: parseInt(r.stockouts ?? '0', 10) }))
      .sort((a: any, b: any) => b.stockouts - a.stockouts)
      .slice(0, 10);

    // Cost-price trend: first vs latest unit cost per stock line.
    const ct = movement(` AND sm.unit_cost IS NOT NULL`);
    const costRows = await m.query(
      `SELECT ${key} AS "itemKey", COALESCE(im.name, ii.name, 'Unknown') AS name, sm.unit_cost AS "unitCost"
         FROM stock_movements sm ${joins}
        WHERE ${ct.sql}
        ORDER BY sm.created_at ASC`,
      ct.params,
    );
    const costByItem = new Map<string, { name: string; first: number; latest: number }>();
    for (const r of costRows) {
      const cost = parseFloat(r.unitCost ?? '0');
      const e = costByItem.get(r.itemKey);
      if (!e) costByItem.set(r.itemKey, { name: r.name, first: cost, latest: cost });
      else e.latest = cost;
    }
    const costTrend = [...costByItem.values()]
      .filter((v) => v.first !== v.latest)
      .map((v) => ({
        name: v.name,
        firstCost: v.first,
        latestCost: v.latest,
        changePct:
          v.first > 0
            ? Math.round(((v.latest - v.first) / v.first) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 10);

    return {
      summary: {
        items,
        lowStock: parseInt(summaryRaw?.low ?? '0', 10),
        outOfStock: parseInt(summaryRaw?.outOfStock ?? '0', 10),
        linked,
        unlinked: items - linked,
        stockValue: parseFloat(summaryRaw?.stockValue ?? '0'),
        expired: parseInt(summaryRaw?.expired ?? '0', 10),
        expiringSoon: parseInt(summaryRaw?.expiringSoon ?? '0', 10),
        expiredValue: parseFloat(summaryRaw?.expiredValue ?? '0'),
      },
      // Phase 24B.5 — reorder coverage (approximate alert→order conversion)
      reorder: {
        linkedItems: linked,
        linkedLowStock: linkedLow,
        reorderedItems,
        coveragePct:
          linked > 0 ? Math.round((reorderedItems / linked) * 1000) / 10 : 0,
      },
      stockouts,
      costTrend,
    };
  }

  /**
   * Phase 24B.3 — supplier performance for one clinic: average receipt lead-time
   * per supplier (received_at − order_date) and price variance for the same item
   * across suppliers (where to negotiate / switch).
   */
  async getSupplierPerformance(organisationId: string, ctx?: AnalyticsBranchCtx) {
    const leadQb = this.purchaseOrdersRepository
      .createQueryBuilder('po')
      .leftJoin(Supplier, 's', 's.id = po.supplierId')
      .select('po.supplierId', 'supplierId')
      .addSelect('MAX(s.name)', 'name')
      .addSelect('COUNT(*)', 'receivedPos')
      .addSelect(
        'AVG(EXTRACT(EPOCH FROM (po.received_at - po.order_date)) / 86400.0)',
        'avgLeadDays',
      )
      .where('po.organisationId = :organisationId', { organisationId })
      .andWhere('po.deletedAt IS NULL')
      .andWhere("po.status = 'received'")
      .andWhere('po.received_at IS NOT NULL')
      .groupBy('po.supplierId');
    this.scopeQb(leadQb, 'po.branchId', ctx?.inventory, ctx?.branchId);
    const leadRows = await leadQb.getRawMany();

    const leadTimeBySupplier = leadRows
      .map((r) => ({
        supplierId: r.supplierId,
        name: r.name ?? 'Unknown',
        receivedPos: parseInt(r.receivedPos ?? '0', 10),
        avgLeadDays: Math.round(parseFloat(r.avgLeadDays ?? '0') * 10) / 10,
      }))
      .sort((a, b) => a.avgLeadDays - b.avgLeadDays);

    const priceQb = this.purchaseOrderItemsRepository
      .createQueryBuilder('poi')
      .leftJoin('poi.purchaseOrder', 'po')
      .select('LOWER(TRIM(poi.itemName))', 'key')
      .addSelect('MAX(poi.itemName)', 'name')
      .addSelect('MIN(poi.unitPrice)', 'minPrice')
      .addSelect('MAX(poi.unitPrice)', 'maxPrice')
      .addSelect('AVG(poi.unitPrice)', 'avgPrice')
      .addSelect('COUNT(DISTINCT po.supplierId)', 'suppliers')
      .where('po.organisationId = :organisationId', { organisationId })
      .andWhere('po.deletedAt IS NULL')
      .andWhere("po.status NOT IN ('draft', 'cancelled')")
      .groupBy('LOWER(TRIM(poi.itemName))')
      .having('MIN(poi.unitPrice) <> MAX(poi.unitPrice)');
    this.scopeQb(priceQb, 'po.branchId', ctx?.inventory, ctx?.branchId);
    const priceRows = await priceQb.getRawMany();

    const priceVariance = priceRows
      .map((r) => {
        const minPrice = parseFloat(r.minPrice ?? '0');
        const maxPrice = parseFloat(r.maxPrice ?? '0');
        return {
          name: r.name,
          minPrice,
          maxPrice,
          avgPrice: Math.round(parseFloat(r.avgPrice ?? '0') * 100) / 100,
          suppliers: parseInt(r.suppliers ?? '0', 10),
          spreadPct:
            minPrice > 0
              ? Math.round(((maxPrice - minPrice) / minPrice) * 1000) / 10
              : 0,
        };
      })
      .sort((a, b) => b.spreadPct - a.spreadPct)
      .slice(0, 15);

    return { leadTimeBySupplier, priceVariance };
  }

  /**
   * Phase 24A.3 — unified spend view for one clinic: medicine procurement
   * (`purchase_orders`, kept as source of truth) shown alongside other
   * `expenses` by category, in one financial picture. We do NOT copy purchases
   * into the expenses ledger (avoids double-count) — they're merged at read time.
   */
  async getSpendSummary(
    organisationId: string,
    startDate?: string,
    endDate?: string,
    ctx?: AnalyticsBranchCtx,
  ) {
    const poQb = this.purchaseOrdersRepository
      .createQueryBuilder('po')
      .select('COALESCE(SUM(po.totalAmount), 0)', 'total')
      .addSelect('COUNT(*)', 'cnt')
      .where('po.organisationId = :organisationId', { organisationId })
      .andWhere('po.deletedAt IS NULL')
      .andWhere("po.status NOT IN ('draft', 'cancelled')");
    if (startDate) poQb.andWhere('po.orderDate >= :startDate', { startDate });
    if (endDate) poQb.andWhere('po.orderDate <= :endDate', { endDate });
    this.scopeQb(poQb, 'po.branchId', ctx?.inventory, ctx?.branchId);
    const poRaw = await poQb.getRawOne();

    const expQb = this.expensesRepository
      .createQueryBuilder('e')
      .select('e.category', 'category')
      .addSelect('COALESCE(SUM(e.amount), 0)', 'amount')
      .where('e.organisationId = :organisationId', { organisationId })
      .andWhere('e.deletedAt IS NULL')
      .groupBy('e.category');
    if (startDate) expQb.andWhere('e.expenseDate >= :startDate', { startDate });
    if (endDate) expQb.andWhere('e.expenseDate <= :endDate', { endDate });
    this.scopeQb(expQb, 'e.branchId', ctx?.patient, ctx?.branchId);
    const expRows = await expQb.getRawMany();

    const expensesByCategory = expRows
      .map((r) => ({
        category: r.category ?? 'Uncategorised',
        amount: parseFloat(r.amount ?? '0'),
      }))
      .sort((a, b) => b.amount - a.amount);

    const purchasesTotal = parseFloat(poRaw?.total ?? '0');
    const expensesTotal = expensesByCategory.reduce((s, c) => s + c.amount, 0);

    return {
      range: { startDate: startDate ?? null, endDate: endDate ?? null },
      purchasesTotal, // medicine procurement (purchase orders)
      purchaseCount: parseInt(poRaw?.cnt ?? '0', 10),
      expensesTotal, // all other expenses
      expensesByCategory,
      combinedTotal: purchasesTotal + expensesTotal,
    };
  }

  /**
   * Phase 24B.6 — postnatal occupancy for one clinic: active admissions, room
   * occupancy, average length of stay, and admissions in the period.
   */
  async getPostnatalOccupancy(
    organisationId: string,
    startDate?: string,
    endDate?: string,
    ctx?: AnalyticsBranchCtx,
  ) {
    const scoped = <T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, column: string) =>
      this.scopeQb(qb, column, ctx?.patient, ctx?.branchId);
    const activeAdmissions = await scoped(
      this.admissionsRepository
        .createQueryBuilder('a')
        .where('a.organisationId = :organisationId', { organisationId })
        .andWhere('a.deletedAt IS NULL')
        .andWhere("a.status = 'ACTIVE'"),
      'a.branchId',
    ).getCount();

    const occupiedRaw = await scoped(
      this.admissionsRepository
        .createQueryBuilder('a')
        .select('COUNT(DISTINCT a.roomId)', 'cnt')
        .where('a.organisationId = :organisationId', { organisationId })
        .andWhere('a.deletedAt IS NULL')
        .andWhere("a.status = 'ACTIVE'"),
      'a.branchId',
    ).getRawOne();
    const occupiedRooms = parseInt(occupiedRaw?.cnt ?? '0', 10);

    const totalRooms = await scoped(
      this.roomsRepository
        .createQueryBuilder('r')
        .where('r.organisationId = :organisationId', { organisationId })
        .andWhere('r.deletedAt IS NULL')
        .andWhere('r.is_active = true'),
      'r.branchId',
    ).getCount();

    const losRaw = await scoped(this.admissionsRepository
      .createQueryBuilder('a')
      .select(
        'AVG(EXTRACT(EPOCH FROM (a.actual_check_out_date - a.check_in_date)) / 86400.0)',
        'avgDays',
      )
      .where('a.organisationId = :organisationId', { organisationId })
      .andWhere('a.deletedAt IS NULL')
      .andWhere("a.status = 'DISCHARGED'")
      .andWhere('a.actual_check_out_date IS NOT NULL'), 'a.branchId')
      .getRawOne();

    const admQb = this.admissionsRepository
      .createQueryBuilder('a')
      .where('a.organisationId = :organisationId', { organisationId })
      .andWhere('a.deletedAt IS NULL')
      .andWhere("a.status <> 'CANCELLED'");
    if (startDate) admQb.andWhere('a.check_in_date >= :startDate', { startDate });
    if (endDate) admQb.andWhere('a.check_in_date <= :endDate', { endDate });
    scoped(admQb, 'a.branchId');
    const admissionsInPeriod = await admQb.getCount();

    return {
      range: { startDate: startDate ?? null, endDate: endDate ?? null },
      activeAdmissions,
      totalRooms,
      occupiedRooms,
      occupancyPct:
        totalRooms > 0
          ? Math.round((occupiedRooms / totalRooms) * 1000) / 10
          : 0,
      avgLengthOfStayDays: Math.round(parseFloat(losRaw?.avgDays ?? '0') * 10) / 10,
      admissionsInPeriod,
    };
  }

  async recordEvents(events: any[], organisationId: string, userId: string) {
    if (!events || !events.length) return { success: true, count: 0 };

    // Registry validation (Usage_Event_Registry_Implementation_Plan.md,
    // decision C): atomic -- any unregistered or inactive eventType fails
    // the whole batch before anything is persisted. Medilink's mobile
    // client already sends every event as part of a batched array (see
    // TelemetryContext.tsx), so there is no true single-event mode to
    // treat differently here.
    const codes = [...new Set(events.map(e => e?.eventType))];
    const registered = await this.usageEventTypeRepository.find({
      where: { code: In(codes) },
      select: ['code', 'isActive', 'allowedMetadataKeys'],
    });
    const byCode = new Map(registered.map(r => [r.code, r]));

    for (const e of events) {
      const entry = byCode.get(e?.eventType);
      if (!entry || !entry.isActive) {
        throw new BadRequestException(
          `Unknown or inactive eventType "${e?.eventType}"`,
        );
      }
    }

    const usageEvents = events.map(e => {
      const entry = byCode.get(e.eventType)!;
      return this.usageEventRepository.create({
        organisation: organisationId ? { id: organisationId } : undefined,
        user: userId ? { id: userId } : undefined,
        eventType: e.eventType,
        screenName: e.screenName,
        metadata: this.filterMetadata(e.metadata, entry.allowedMetadataKeys),
        platform: e.platform,
        appVersion: e.appVersion,
        sessionId: e.sessionId,
        occurredAt: e.occurredAt ? new Date(e.occurredAt) : new Date(),
      });
    });

    await this.usageEventRepository.save(usageEvents);
    return { success: true, count: usageEvents.length };
  }

  // Decision D: strip metadata keys outside the event's allowlist, don't
  // reject the batch over them -- an unregistered eventType is a client
  // bug worth surfacing hard; an unexpected metadata key on an otherwise
  // valid event is far more likely a developer adding a useful field
  // without updating the allowlist yet. A NULL allowlist (event not yet
  // reviewed) passes metadata through unfiltered -- not an error.
  private filterMetadata(metadata: any, allowedKeys: string[] | null): any {
    if (!metadata || !allowedKeys) return metadata;
    const filtered: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (key in metadata) filtered[key] = metadata[key];
    }
    const dropped = Object.keys(metadata).filter(k => !allowedKeys.includes(k));
    if (dropped.length) {
      this.logger.warn(`Dropped unregistered metadata keys [${dropped.join(', ')}] from event`);
    }
    return filtered;
  }

  async getTelemetryStats() {
    // Top screens/features based on 'screen_view' event
    const topFeaturesRaw = await this.usageEventRepository
      .createQueryBuilder('u')
      .select('u.screenName', 'name')
      .addSelect('COUNT(*)', 'views')
      .where('u.eventType = :eventType', { eventType: 'screen_view' })
      .andWhere('u.screenName IS NOT NULL')
      .groupBy('u.screenName')
      .orderBy('COUNT(*)', 'DESC')
      .limit(5)
      .getRawMany();

    const topFeatures = topFeaturesRaw.map(r => ({
      name: r.name || 'Unknown',
      views: parseInt(r.views, 10) || 0,
    }));

    // Platform breakdown
    const platformSplitRaw = await this.usageEventRepository
      .createQueryBuilder('u')
      .select('u.platform', 'platform')
      .addSelect('COUNT(DISTINCT u.sessionId)', 'sessions')
      .where('u.platform IS NOT NULL')
      .groupBy('u.platform')
      .getRawMany();

    const platformSplit = platformSplitRaw.map(r => ({
      platform: r.platform || 'unknown',
      sessions: parseInt(r.sessions, 10) || 0,
    }));

    // Daily Active Users (Last 7 days)
    // We proxy "DAU" by counting distinct user_ids or session_ids per day
    const dauRaw = await this.usageEventRepository
      .createQueryBuilder('u')
      .select("TO_CHAR(u.occurredAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(DISTINCT COALESCE(CAST(u.user_id AS TEXT), u.sessionId))', 'activeUsers')
      .where("u.occurredAt >= CURRENT_DATE - INTERVAL '7 days'")
      .groupBy("TO_CHAR(u.occurredAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    const dau = dauRaw.map(r => ({
      date: r.date,
      count: parseInt(r.activeUsers, 10) || 0,
    }));

    return {
      topFeatures,
      platformSplit,
      dau,
    };
  }

  /**
   * 20M — which clinics use which features/modules most (usage_events grouped
   * by organisation, with each org's top screens nested underneath).
   */
  async getFeatureUsageByOrg(startDate?: string, endDate?: string, limit: number = 15) {
    // Tracking Phase 4/5 item 4 -- meaningfulEvents added alongside
    // totalEvents, not replacing it. Real data confirmed the exact
    // concern this item was checking for: app_open/app_foreground/
    // app_background are 68.7% of all usage_events (verified via a real
    // GROUP BY), never carry a screenName, and are therefore already
    // excluded from topFeatures below -- but nothing excluded them from
    // totalEvents, the field this method's ranking/ORDER BY is actually
    // built on. That's a real inconsistency between what selects the top
    // N orgs and what's shown about them, not a hypothetical one: two
    // real orgs in this data have meaningful-event ratios of 39% and 12%
    // of their totalEvents respectively -- a materially different
    // "actually active" story totalEvents alone can't tell.
    //
    // Deliberately NOT changing what totalEvents means or what the
    // ranking/ORDER BY/LIMIT here is based on -- this already feeds a
    // live screen (TelemetryDashboardScreen's "Most Active Clinics"), and
    // silently changing which orgs rank in the top N as a side effect of
    // a "reporting improvement" would be a real behavior change, not a
    // read-side addition. meaningfulEvents is additive so a consumer can
    // choose to re-sort or display both, without this commit deciding
    // that for them.
    const orgTotalsQb = this.usageEventRepository
      .createQueryBuilder('u')
      .select('u.organisation_id', 'orgId')
      .addSelect('COUNT(*)', 'totalEvents')
      .addSelect(
        "COUNT(*) FILTER (WHERE u.event_type NOT IN ('app_open', 'app_foreground', 'app_background'))",
        'meaningfulEvents',
      )
      .where('u.organisation_id IS NOT NULL');
    if (startDate) orgTotalsQb.andWhere('u.occurredAt >= :startDate', { startDate });
    if (endDate) orgTotalsQb.andWhere('u.occurredAt <= :endDate', { endDate });
    const orgTotals = await orgTotalsQb
      .groupBy('u.organisation_id')
      .orderBy('COUNT(*)', 'DESC')
      .limit(limit)
      .getRawMany();

    const orgIds = orgTotals.map((r) => r.orgId);
    if (!orgIds.length) return [];

    const featuresQb = this.usageEventRepository
      .createQueryBuilder('u')
      .select('u.organisation_id', 'orgId')
      .addSelect('u.screenName', 'screenName')
      .addSelect('COUNT(*)', 'count')
      .where('u.organisation_id IN (:...orgIds)', { orgIds })
      .andWhere('u.screenName IS NOT NULL');
    if (startDate) featuresQb.andWhere('u.occurredAt >= :startDate', { startDate });
    if (endDate) featuresQb.andWhere('u.occurredAt <= :endDate', { endDate });
    const featureRows = await featuresQb
      .groupBy('u.organisation_id')
      .addGroupBy('u.screenName')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    const orgs = await this.organisationsRepository
      .createQueryBuilder('org')
      .select(['org.id AS id', 'org.name AS name'])
      .where('org.id IN (:...orgIds)', { orgIds })
      .getRawMany();
    const nameById = new Map(orgs.map((o) => [o.id, o.name]));

    const featuresByOrg = new Map<string, { screenName: string; count: number }[]>();
    for (const r of featureRows) {
      const list = featuresByOrg.get(r.orgId) ?? [];
      if (list.length < 5) list.push({ screenName: r.screenName, count: parseInt(r.count, 10) || 0 });
      featuresByOrg.set(r.orgId, list);
    }

    return orgTotals.map((r) => ({
      organisationId: r.orgId,
      organisationName: nameById.get(r.orgId) ?? 'Unknown',
      totalEvents: parseInt(r.totalEvents, 10) || 0,
      meaningfulEvents: parseInt(r.meaningfulEvents, 10) || 0,
      topFeatures: featuresByOrg.get(r.orgId) ?? [],
    }));
  }

  /**
   * 20M — which staff use which features/modules most. Optionally scoped to
   * one organisation (used by the dashboard's drill-in from getFeatureUsageByOrg).
   * Role is the user's *current* organisation_users role, not role-at-event-time.
   */
  async getFeatureUsageByUser(
    organisationId?: string,
    startDate?: string,
    endDate?: string,
    limit: number = 20,
  ) {
    // Tracking Phase 4/5 item 4 -- see getFeatureUsageByOrg's comment for
    // the full rationale (same finding, same fix, same "additive, doesn't
    // change the existing ranking" constraint).
    const userTotalsQb = this.usageEventRepository
      .createQueryBuilder('u')
      .select('u.user_id', 'userId')
      .addSelect('COUNT(*)', 'totalEvents')
      .addSelect(
        "COUNT(*) FILTER (WHERE u.event_type NOT IN ('app_open', 'app_foreground', 'app_background'))",
        'meaningfulEvents',
      )
      .where('u.user_id IS NOT NULL');
    if (organisationId) userTotalsQb.andWhere('u.organisation_id = :organisationId', { organisationId });
    if (startDate) userTotalsQb.andWhere('u.occurredAt >= :startDate', { startDate });
    if (endDate) userTotalsQb.andWhere('u.occurredAt <= :endDate', { endDate });
    const userTotals = await userTotalsQb
      .groupBy('u.user_id')
      .orderBy('COUNT(*)', 'DESC')
      .limit(limit)
      .getRawMany();

    const userIds = userTotals.map((r) => r.userId);
    if (!userIds.length) return [];

    const featuresQb = this.usageEventRepository
      .createQueryBuilder('u')
      .select('u.user_id', 'userId')
      .addSelect('u.screenName', 'screenName')
      .addSelect('COUNT(*)', 'count')
      .where('u.user_id IN (:...userIds)', { userIds })
      .andWhere('u.screenName IS NOT NULL');
    if (organisationId) featuresQb.andWhere('u.organisation_id = :organisationId', { organisationId });
    if (startDate) featuresQb.andWhere('u.occurredAt >= :startDate', { startDate });
    if (endDate) featuresQb.andWhere('u.occurredAt <= :endDate', { endDate });
    const featureRows = await featuresQb
      .groupBy('u.user_id')
      .addGroupBy('u.screenName')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    const users = await this.usersRepository
      .createQueryBuilder('user')
      .select(['user.id AS id', 'user.firstName AS "firstName"', 'user.lastName AS "lastName"'])
      .where('user.id IN (:...userIds)', { userIds })
      .getRawMany();
    const userById = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    const roleQb = this.organisationUsersRepository
      .createQueryBuilder('ou')
      .select(['ou.userId AS "userId"', 'ou.role AS role', 'ou.organisationId AS "organisationId"'])
      .where('ou.userId IN (:...userIds)', { userIds });
    if (organisationId) roleQb.andWhere('ou.organisationId = :organisationId', { organisationId });
    const roleRows = await roleQb.getRawMany();
    const roleByUser = new Map(roleRows.map((r) => [r.userId, r.role]));

    // Uncapped — the Telemetry "clinic detail" screen shows every module a
    // staff member has used, not just a top-N teaser (unlike featuresByOrg
    // above, which stays capped since it only feeds a dashboard summary).
    const featuresByUser = new Map<string, { screenName: string; count: number }[]>();
    for (const r of featureRows) {
      const list = featuresByUser.get(r.userId) ?? [];
      list.push({ screenName: r.screenName, count: parseInt(r.count, 10) || 0 });
      featuresByUser.set(r.userId, list);
    }

    return userTotals.map((r) => ({
      userId: r.userId,
      userName: userById.get(r.userId) ?? 'Unknown',
      role: roleByUser.get(r.userId) ?? null,
      totalEvents: parseInt(r.totalEvents, 10) || 0,
      meaningfulEvents: parseInt(r.meaningfulEvents, 10) || 0,
      topFeatures: featuresByUser.get(r.userId) ?? [],
    }));
  }

  // Which medicines a clinic is actually searching for / adding to cart —
  // ProductsScreen's 'search' and 'add_to_cart' events carry this in
  // metadata (jsonb) already; this is the first place it gets aggregated
  // and surfaced instead of sitting unused in usage_events.
  async getMarketplaceActivityByOrg(
    organisationId?: string,
    startDate?: string,
    endDate?: string,
    limit: number = 20,
  ) {
    const searchQb = this.usageEventRepository
      .createQueryBuilder('u')
      .select("u.metadata->>'query'", 'query')
      .addSelect('COUNT(*)', 'count')
      .where("u.event_type = 'search'")
      // Search_Tracking_Phase2_Implementation_Plan.md, decision B: once
      // other screens (Patients, Staff, CRM, ...) also fire 'search'
      // events, this "Top Searches" widget must stay scoped to the
      // medicine/product catalog search it was built for, or it starts
      // mixing patient/staff names into a medicine-search report.
      .andWhere("u.screen_name = 'ProductsScreen'")
      .andWhere("u.metadata->>'query' IS NOT NULL")
      .andWhere("trim(u.metadata->>'query') != ''");
    if (organisationId) searchQb.andWhere('u.organisation_id = :organisationId', { organisationId });
    if (startDate) searchQb.andWhere('u.occurredAt >= :startDate', { startDate });
    if (endDate) searchQb.andWhere('u.occurredAt <= :endDate', { endDate });
    const searchRows = await searchQb
      .groupBy("u.metadata->>'query'")
      .orderBy('COUNT(*)', 'DESC')
      .limit(limit)
      .getRawMany();

    const productsQb = this.usageEventRepository
      .createQueryBuilder('u')
      .select("u.metadata->>'productName'", 'productName')
      .addSelect('COUNT(*)', 'count')
      .where("u.event_type = 'add_to_cart'")
      .andWhere("u.metadata->>'productName' IS NOT NULL");
    if (organisationId) productsQb.andWhere('u.organisation_id = :organisationId', { organisationId });
    if (startDate) productsQb.andWhere('u.occurredAt >= :startDate', { startDate });
    if (endDate) productsQb.andWhere('u.occurredAt <= :endDate', { endDate });
    const productRows = await productsQb
      .groupBy("u.metadata->>'productName'")
      .orderBy('COUNT(*)', 'DESC')
      .limit(limit)
      .getRawMany();

    return {
      topSearches: searchRows.map((r) => ({ query: r.query as string, count: parseInt(r.count, 10) || 0 })),
      topProducts: productRows.map((r) => ({ productName: r.productName as string, count: parseInt(r.count, 10) || 0 })),
    };
  }

  // Recent booking lifecycle activity (create/confirm/cancel/check-in/promote/
  // edit/remove) for the clinic detail screen's "Booking Activity" feed —
  // each row includes the full metadata captured by BookingsScreen's
  // trackEvent calls (patient/enquiry identity, room, dates, price).
  private static readonly BOOKING_EVENT_TYPES = [
    'booking_created',
    'booking_confirmed',
    'booking_cancelled',
    'booking_checked_in',
    'booking_promoted_to_patient',
    'booking_removed',
    'booking_edited',
  ];

  async getBookingActivityByOrg(organisationId?: string, limit: number = 30) {
    const qb = this.usageEventRepository
      .createQueryBuilder('u')
      .leftJoin('u.user', 'usr')
      .select(['u.id', 'u.eventType', 'u.metadata', 'u.occurredAt'])
      .addSelect('usr.id', 'userId')
      .where('u.event_type IN (:...types)', { types: AnalyticsService.BOOKING_EVENT_TYPES });
    if (organisationId) qb.andWhere('u.organisation_id = :organisationId', { organisationId });
    const { entities, raw } = await qb
      .orderBy('u.occurredAt', 'DESC')
      .limit(limit)
      .getRawAndEntities();

    const userIds = [...new Set(raw.map((r) => r.userId).filter((id): id is string => !!id))];
    const users = userIds.length
      ? await this.usersRepository
          .createQueryBuilder('user')
          .select(['user.id AS id', 'user.firstName AS "firstName"', 'user.lastName AS "lastName"'])
          .where('user.id IN (:...userIds)', { userIds })
          .getRawMany()
      : [];
    const nameByUserId = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    return entities.map((e, i) => ({
      id: e.id,
      eventType: e.eventType,
      occurredAt: e.occurredAt,
      userName: raw[i]?.userId ? nameByUserId.get(raw[i].userId) ?? null : null,
      metadata: e.metadata ?? {},
    }));
  }

  async getMarketplaceAnalytics(days: number = 30) {
    // 1. Buyer Demographics
    const buyerTypesRaw = await this.organisationsRepository.createQueryBuilder('org')
      .innerJoin('orders', 'o', 'o.organisation_id = org.id')
      .select('org.type', 'type')
      .addSelect('COUNT(DISTINCT o.id)', 'orderCount')
      .addSelect('SUM(o.total_amount)', 'totalSpent')
      .where(`o.created_at >= CURRENT_DATE - INTERVAL '${days} days'`)
      .andWhere("o.status NOT IN ('cancelled', 'returned')")
      .groupBy('org.type')
      .getRawMany();

    const buyerDemographics = buyerTypesRaw.map(r => ({
      type: r.type || 'Unknown',
      orderCount: parseInt(r.orderCount, 10) || 0,
      totalSpent: parseFloat(r.totalSpent) || 0,
    }));

    // 2. Top Selling Medicines
    // T19 fix (2026-09-16, scope/Handoff_Blocker_Fixes_2026-09-16.md): units
    // sold must be item.packedQuantity (actual-supplied), not item.quantity
    // (immutable originally-requested amount) -- a packing shortfall
    // otherwise overstates units sold. Also restrict to orders that have
    // actually reached PACKED/SHIPPED/DELIVERED -- the old
    // NOT IN ('cancelled','returned') filter let pending/confirmed/
    // processing orders (nothing packed yet) contribute fake units and
    // revenue. The revenue side (item.totalAmount) is unaffected by this
    // change -- it was already correctly resynced from packedQuantity at
    // the PACKED transition (orders.service.ts), this fix is purely the
    // units-sold field and the status filter.
    const topMedicinesRaw = await this.ordersRepository.createQueryBuilder('o')
      .innerJoin('o.items', 'item')
      .select('item.productName', 'name')
      .addSelect('SUM(item.packedQuantity)', 'totalQuantity')
      .addSelect('SUM(item.totalAmount)', 'totalRevenue')
      .where(`o.createdAt >= CURRENT_DATE - INTERVAL '${days} days'`)
      .andWhere("o.status IN ('packed', 'shipped', 'delivered')")
      .groupBy('item.productName')
      .orderBy('SUM(item.packedQuantity)', 'DESC')
      .limit(10)
      .getRawMany();

    const topMedicines = topMedicinesRaw.map(r => ({
      name: r.name,
      quantity: parseInt(r.totalQuantity, 10) || 0,
      revenue: parseFloat(r.totalRevenue) || 0,
    }));

    // 3. Sales Rate (Daily orders & revenue)
    const salesRateRaw = await this.ordersRepository.createQueryBuilder('o')
      .select("TO_CHAR(o.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(o.id)', 'orders')
      .addSelect('SUM(o.totalAmount)', 'revenue')
      .where(`o.createdAt >= CURRENT_DATE - INTERVAL '${days} days'`)
      .andWhere("o.status NOT IN ('cancelled', 'returned')")
      .groupBy("TO_CHAR(o.createdAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    const salesRate = salesRateRaw.map(r => ({
      date: r.date,
      orders: parseInt(r.orders, 10) || 0,
      revenue: parseFloat(r.revenue) || 0,
    }));

    return {
      buyerDemographics,
      topMedicines,
      salesRate,
    };
  }

  async getFunnelAnalytics(days: number = 30) {
    // 1. Search Intent (Top searches)
    const searchIntentRaw = await this.usageEventRepository.createQueryBuilder('u')
      .select("u.metadata->>'query'", 'query')
      .addSelect('COUNT(*)', 'searches')
      .where("u.eventType = 'search'")
      .andWhere(`u.occurredAt >= CURRENT_DATE - INTERVAL '${days} days'`)
      .groupBy("u.metadata->>'query'")
      .orderBy('COUNT(*)', 'DESC')
      .limit(10)
      .getRawMany();

    const searchIntent = searchIntentRaw
      .filter(r => r.query) // remove nulls if any
      .map(r => ({
        query: r.query,
        searches: parseInt(r.searches, 10) || 0,
      }));

    // 2. Checkout Abandonment Rate
    const checkoutStarted = await this.usageEventRepository.count({
      where: { eventType: 'checkout_started' },
    });
    const checkoutCompleted = await this.usageEventRepository.count({
      where: { eventType: 'checkout_completed' },
    });

    // 3. Registration Abandonment Rate
    const registrationStarted = await this.usageEventRepository.count({
      where: { eventType: 'registration_started' },
    });
    const registrationCompleted = await this.usageEventRepository.count({
      where: { eventType: 'registration_completed' },
    });

    // 4. Time-to-Value (Average days from org approval to first order)
    // We get the first order per organisation, and compare its created_at with org's approved_at
    const timeToValueRaw = await this.ordersRepository.createQueryBuilder('o')
      .innerJoin('organisations', 'org', 'o.organisation_id = org.id')
      .select('AVG(EXTRACT(EPOCH FROM (o.created_at - org.approved_at)) / 86400)', 'avgDays')
      .where('org.approved_at IS NOT NULL')
      .andWhere(qb => {
        const subQuery = qb.subQuery()
          .select('MIN(o2.created_at)')
          .from('orders', 'o2')
          .where('o2.organisation_id = o.organisation_id')
          .getQuery();
        return `o.created_at = ${subQuery}`;
      })
      .getRawOne();

    const avgDaysToFirstPurchase = parseFloat(timeToValueRaw?.avgDays || '0');

    // 5. Marketplace funnel (Tracking Phase 4 -- reporting, not new
    // instrumentation, see scope/Tracking_Phase4_Question_Coverage_Recon.md
    // question #3). Session-scoped stage counts using the sessionId every
    // usage_events row already carries -- NOT a strict sequential funnel
    // (a session reaching "addedToCart" is not asserted to have also
    // reached "searched" first, since browsing without a text search is a
    // real path through ProductsScreen, e.g. via category filter alone).
    // Reported as independent per-stage session counts within the window,
    // not chained conversion rates, so the numbers can't imply a causal
    // order the data doesn't actually prove.
    const marketplaceFunnelRaw = await this.usageEventRepository
      .createQueryBuilder('u')
      .select(
        "COUNT(DISTINCT CASE WHEN u.event_type = 'search' AND u.screen_name = 'ProductsScreen' THEN u.session_id END)",
        'searched',
      )
      .addSelect(
        "COUNT(DISTINCT CASE WHEN u.event_type = 'add_to_cart' THEN u.session_id END)",
        'addedToCart',
      )
      .addSelect(
        "COUNT(DISTINCT CASE WHEN u.event_type = 'checkout_started' THEN u.session_id END)",
        'checkoutStarted',
      )
      .addSelect(
        "COUNT(DISTINCT CASE WHEN u.event_type = 'checkout_completed' THEN u.session_id END)",
        'checkoutCompleted',
      )
      .where(`u.occurredAt >= CURRENT_DATE - INTERVAL '${days} days'`)
      .andWhere('u.sessionId IS NOT NULL')
      .getRawOne();

    const marketplaceFunnel = {
      searched: parseInt(marketplaceFunnelRaw?.searched || '0', 10),
      addedToCart: parseInt(marketplaceFunnelRaw?.addedToCart || '0', 10),
      checkoutStarted: parseInt(marketplaceFunnelRaw?.checkoutStarted || '0', 10),
      checkoutCompleted: parseInt(marketplaceFunnelRaw?.checkoutCompleted || '0', 10),
    };

    // 6. Booking lifecycle -- Tracking Phase 4 recon question #10/#11, item
    // 2 of the reporting workstream (see
    // scope/Tracking_Phase4_Question_Coverage_Recon.md). Two DELIBERATELY
    // SEPARATE views, not one blended number -- see the plan doc for why:
    //
    // (a) bookingFunnel: event-derived, from usage_events. NOT a
    // bookingId-joined per-booking conversion -- confirmed by tracing the
    // real code that booking_created's trackEvent() call fires BEFORE
    // createMutation.mutate() runs, so it has no bookingId to attach
    // (every other booking_* event fires AFTER its mutation, with a real
    // RoomBooking object, and does carry one). "created" is therefore a
    // raw event count; the later stages are COUNT(DISTINCT bookingId) to
    // avoid double-counting one booking confirmed/checked-in more than
    // once. This is telemetry-observed activity, not a guaranteed-complete
    // record -- usage_events is client-side, best-effort delivery.
    //
    // (b) bookingStatusSnapshot: the AUTHORITATIVE current-state count,
    // straight from room_bookings.status -- always accurate regardless of
    // any tracking gap, but a snapshot only: a booking confirmed and later
    // cancelled shows only as CANCELLED here, with no history of having
    // passed through CONFIRMED. That history is exactly what (a) is for.
    // Neither view alone answers "conversion AND history" -- that's why
    // both are returned rather than picking one.
    const bookingFunnelRaw = await this.usageEventRepository
      .createQueryBuilder('u')
      .select("COUNT(CASE WHEN u.event_type = 'booking_created' THEN 1 END)", 'created')
      .addSelect(
        "COUNT(DISTINCT CASE WHEN u.event_type = 'booking_confirmed' THEN u.metadata->>'bookingId' END)",
        'confirmed',
      )
      .addSelect(
        "COUNT(DISTINCT CASE WHEN u.event_type = 'booking_promoted_to_patient' THEN u.metadata->>'bookingId' END)",
        'promotedToPatient',
      )
      .addSelect(
        "COUNT(DISTINCT CASE WHEN u.event_type = 'booking_checked_in' THEN u.metadata->>'bookingId' END)",
        'checkedIn',
      )
      .addSelect(
        "COUNT(DISTINCT CASE WHEN u.event_type = 'booking_cancelled' THEN u.metadata->>'bookingId' END)",
        'cancelled',
      )
      .where(`u.occurredAt >= CURRENT_DATE - INTERVAL '${days} days'`)
      .andWhere("u.event_type LIKE 'booking_%'")
      .getRawOne();

    const bookingFunnel = {
      created: parseInt(bookingFunnelRaw?.created || '0', 10),
      confirmed: parseInt(bookingFunnelRaw?.confirmed || '0', 10),
      promotedToPatient: parseInt(bookingFunnelRaw?.promotedToPatient || '0', 10),
      checkedIn: parseInt(bookingFunnelRaw?.checkedIn || '0', 10),
      cancelled: parseInt(bookingFunnelRaw?.cancelled || '0', 10),
    };

    const statusSnapshotRaw = await this.roomBookingsRepository
      .createQueryBuilder('rb')
      .select('rb.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('rb.deletedAt IS NULL')
      .groupBy('rb.status')
      .getRawMany();

    const bookingStatusSnapshot = statusSnapshotRaw.reduce((acc, r) => {
      acc[r.status] = parseInt(r.count, 10) || 0;
      return acc;
    }, {} as Record<string, number>);

    return {
      searchIntent,
      checkoutFunnel: {
        started: checkoutStarted,
        completed: checkoutCompleted,
        rate: checkoutStarted > 0 ? (checkoutCompleted / checkoutStarted) * 100 : 0,
      },
      registrationFunnel: {
        started: registrationStarted,
        completed: registrationCompleted,
        rate: registrationStarted > 0 ? (registrationCompleted / registrationStarted) * 100 : 0,
      },
      timeToValueDays: avgDaysToFirstPurchase,
      marketplaceFunnel,
      bookingFunnel,
      bookingStatusSnapshot,
    };
  }

  /**
   * Tracking Phase 4/5 item 3 (screen engagement -> subsequent meaningful
   * action; see scope/Tracking_Phase4_Question_Coverage_Recon.md question
   * #17). Answers one concrete question at a time -- "of sessions that
   * viewed <fromScreen>, how many subsequently performed <toEventType>
   * within <withinMinutes>?" -- rather than a per-screen engagement score
   * for every screen, which would manufacture a ranking nobody asked for.
   *
   * Why a bounded time window, not just "same sessionId": traced
   * TelemetryContext.tsx's actual sessionId lifecycle -- it's generated
   * once per app launch (a useRef, not tied to login or any visit
   * boundary) and never resets on backgrounding, only on a genuine app
   * restart. Confirmed against real data this is not a theoretical
   * concern: real sessions span up to ~38 hours. A bare sessionId match
   * with no time bound would count something that happened a day later in
   * the same never-restarted session as "subsequent," which isn't what
   * the question means. 30 minutes is the same session-timeout
   * convention most web analytics tools default to -- not tuned against
   * this app's data, an explicit, documented, overridable choice.
   *
   * Matching is done in application code, not a correlated SQL subquery:
   * data volume here is small (~9k total usage_events rows at the time
   * this was written) and per-session temporal matching in JS is more
   * obviously correct than forcing a per-row-bounded EXISTS into
   * TypeORM's QueryBuilder DSL, which has no clean way to express "a
   * later event within N minutes of THIS row's own timestamp" without a
   * correlated subquery.
   *
   * Deliberately does NOT claim the remainder "abandoned" -- a session
   * with a view but no matching subsequent action may have completed the
   * action through an untracked path, in a different session, or simply
   * outside the window. The caveat field says this explicitly rather than
   * letting a bare ratio imply more certainty than the data supports.
   */
  async getScreenToActionConversion(
    fromScreen: string,
    toEventType: string,
    days: number = 30,
    withinMinutes: number = 30,
  ) {
    const views = await this.usageEventRepository
      .createQueryBuilder('v')
      .select('v.sessionId', 'sessionId')
      .addSelect('v.occurredAt', 'occurredAt')
      .where("v.eventType = 'screen_view'")
      .andWhere('v.screenName = :fromScreen', { fromScreen })
      .andWhere(`v.occurredAt >= CURRENT_DATE - INTERVAL '${days} days'`)
      .andWhere('v.sessionId IS NOT NULL')
      .orderBy('v.occurredAt', 'ASC')
      .getRawMany();

    // Earliest view per session in the window -- "of sessions that viewed
    // X" counts a session once regardless of how many times it viewed X.
    const firstViewBySession = new Map<string, Date>();
    for (const row of views) {
      if (!firstViewBySession.has(row.sessionId)) {
        firstViewBySession.set(row.sessionId, new Date(row.occurredAt));
      }
    }
    const viewed = firstViewBySession.size;

    if (viewed === 0) {
      return {
        fromScreen, toEventType, days, withinMinutes,
        viewed: 0, subsequentAction: 0, rate: 0,
        caveat: 'No sessions viewed this screen in the given window.',
      };
    }

    const sessionIds = [...firstViewBySession.keys()];
    const actions = await this.usageEventRepository
      .createQueryBuilder('a')
      .select('a.sessionId', 'sessionId')
      .addSelect('a.occurredAt', 'occurredAt')
      .where('a.eventType = :toEventType', { toEventType })
      .andWhere('a.sessionId IN (:...sessionIds)', { sessionIds })
      .getRawMany();

    let subsequentAction = 0;
    for (const sessionId of sessionIds) {
      const viewedAt = firstViewBySession.get(sessionId)!;
      const matched = actions.some((a) => {
        if (a.sessionId !== sessionId) return false;
        const diffMinutes = (new Date(a.occurredAt).getTime() - viewedAt.getTime()) / 60000;
        return diffMinutes > 0 && diffMinutes <= withinMinutes;
      });
      if (matched) subsequentAction++;
    }

    return {
      fromScreen,
      toEventType,
      days,
      withinMinutes,
      viewed,
      subsequentAction,
      rate: viewed > 0 ? (subsequentAction / viewed) * 100 : 0,
      caveat: 'A session with no matching subsequent action is not proof of abandonment -- the action may have happened through an untracked path, in a different session, or outside this time window.',
    };
  }
}
