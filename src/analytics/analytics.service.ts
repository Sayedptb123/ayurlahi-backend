import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
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
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchase-orders/entities/purchase-order-item.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Admission } from '../retreat/entities/admission.entity';
import { Room } from '../retreat/entities/room.entity';

@Injectable()
export class AnalyticsService {
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
  ) { }

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
  ) {
    const dateFilter = (col: string) => {
      const parts: string[] = [];
      if (startDate) parts.push(`${col} >= '${startDate}'`);
      if (endDate) parts.push(`${col} <= '${endDate}'`);
      return parts.length ? parts.join(' AND ') : null;
    };

    // Total patients
    const totalPatients = await this.patientsRepository
      .createQueryBuilder('p')
      .where('p.organisationId = :organisationId', { organisationId })
      .andWhere('p.deletedAt IS NULL')
      .getCount();

    // Total appointments
    const apptQb = this.appointmentsRepository
      .createQueryBuilder('a')
      .where('a.organisationId = :organisationId', { organisationId })
      .andWhere('a.deletedAt IS NULL');
    const apptDateFilter = dateFilter('a.appointmentDate');
    if (apptDateFilter) apptQb.andWhere(apptDateFilter);
    const totalAppointments = await apptQb.getCount();

    // Appointments by status
    const apptByStatusQb = this.appointmentsRepository
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('a.organisationId = :organisationId', { organisationId })
      .andWhere('a.deletedAt IS NULL')
      .groupBy('a.status');
    const apptByStatusDateFilter = dateFilter('a.appointmentDate');
    if (apptByStatusDateFilter) apptByStatusQb.andWhere(apptByStatusDateFilter);
    const apptByStatusRaw = await apptByStatusQb.getRawMany();
    const appointmentsByStatus = apptByStatusRaw.map((r) => ({
      status: r.status,
      count: parseInt(r.count, 10),
    }));

    // Revenue from paid/partial bills
    const revenueQb = this.billsRepository
      .createQueryBuilder('b')
      .select('COALESCE(SUM(b.paidAmount), 0)', 'revenue')
      .where('b.organisationId = :organisationId', { organisationId })
      .andWhere('b.deletedAt IS NULL')
      .andWhere("b.status IN ('paid', 'partial')");
    const billDateFilter = dateFilter('b.billDate');
    if (billDateFilter) revenueQb.andWhere(billDateFilter);
    const revenueResult = await revenueQb.getRawOne();
    const totalRevenue = parseFloat(revenueResult?.revenue ?? '0');

    // Total expenses
    const expQb = this.expensesRepository
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'total')
      .where('e.organisationId = :organisationId', { organisationId })
      .andWhere('e.deletedAt IS NULL');
    const expDateFilter = dateFilter('e.expenseDate');
    if (expDateFilter) expQb.andWhere(expDateFilter);
    const expResult = await expQb.getRawOne();
    const totalExpenses = parseFloat(expResult?.total ?? '0');

    // Revenue by month (last 12 months or within date range)
    const revenueByMonthQb = this.billsRepository
      .createQueryBuilder('b')
      .select("TO_CHAR(b.billDate, 'Mon YYYY')", 'month')
      .addSelect("DATE_TRUNC('month', b.billDate)", 'monthStart')
      .addSelect('COALESCE(SUM(b.paidAmount), 0)', 'amount')
      .where('b.organisationId = :organisationId', { organisationId })
      .andWhere('b.deletedAt IS NULL')
      .andWhere("b.status IN ('paid', 'partial')")
      .groupBy("TO_CHAR(b.billDate, 'Mon YYYY'), DATE_TRUNC('month', b.billDate)")
      .orderBy("DATE_TRUNC('month', b.billDate)", 'ASC')
      .limit(12);
    if (billDateFilter) revenueByMonthQb.andWhere(billDateFilter);
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
      this.spendBySupplier(organisationId, startDate, endDate),
      this.spendByMedicine(organisationId, startDate, endDate),
      this.unmetDemandForClinic(organisationId),
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
  private async unmetDemandForClinic(organisationId: string) {
    const rows = await this.inventoryItemsRepository
      .createQueryBuilder('item')
      .select('item.name', 'name')
      .addSelect('item.currentStock', 'currentStock')
      .addSelect('item.minStockLevel', 'minStockLevel')
      .where('item.organisationId = :organisationId', { organisationId })
      .andWhere('item.deletedAt IS NULL')
      .andWhere('item.productId IS NULL')
      .andWhere('item.currentStock <= item.minStockLevel')
      .orderBy('item.name', 'ASC')
      .limit(50)
      .getRawMany();
    return rows.map((r) => ({
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
  async getInventoryHealth(organisationId: string) {
    const summaryRaw = await this.inventoryItemsRepository
      .createQueryBuilder('item')
      .select('COUNT(*)', 'items')
      .addSelect(
        'COUNT(*) FILTER (WHERE item.current_stock <= item.min_stock_level)',
        'low',
      )
      .addSelect('COUNT(*) FILTER (WHERE item.current_stock = 0)', 'outOfStock')
      .addSelect('COUNT(item.product_id)', 'linked')
      .addSelect(
        'COUNT(*) FILTER (WHERE item.product_id IS NOT NULL AND item.current_stock <= item.min_stock_level)',
        'linkedLow',
      )
      .addSelect(
        'COALESCE(SUM(item.current_stock * COALESCE(item.cost_price, item.unit_price, 0)), 0)',
        'stockValue',
      )
      // Phase 24C.2 — dead/expired-stock (needs batch/expiry)
      .addSelect(
        'COUNT(*) FILTER (WHERE item.expiry_date IS NOT NULL AND item.expiry_date < CURRENT_DATE AND item.current_stock > 0)',
        'expired',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE item.expiry_date IS NOT NULL AND item.expiry_date >= CURRENT_DATE AND item.expiry_date < CURRENT_DATE + INTERVAL '30 days' AND item.current_stock > 0)",
        'expiringSoon',
      )
      .addSelect(
        'COALESCE(SUM(item.current_stock * COALESCE(item.cost_price, item.unit_price, 0)) FILTER (WHERE item.expiry_date IS NOT NULL AND item.expiry_date < CURRENT_DATE), 0)',
        'expiredValue',
      )
      .where('item.organisationId = :organisationId', { organisationId })
      .andWhere('item.deletedAt IS NULL')
      .getRawOne();

    const items = parseInt(summaryRaw?.items ?? '0', 10);
    const linked = parseInt(summaryRaw?.linked ?? '0', 10);
    const linkedLow = parseInt(summaryRaw?.linkedLow ?? '0', 10);

    // Phase 24B.5 — reorder coverage: linked items that have actually been
    // reordered on-platform (≥1 order_delivery movement) vs all linked items.
    const reorderedRaw = await this.stockMovementsRepository
      .createQueryBuilder('sm')
      .select('COUNT(DISTINCT sm.inventoryItemId)', 'cnt')
      .where('sm.organisationId = :organisationId', { organisationId })
      .andWhere('sm.deletedAt IS NULL')
      .andWhere("sm.movementType = 'order_delivery'")
      .getRawOne();
    const reorderedItems = parseInt(reorderedRaw?.cnt ?? '0', 10);

    // Stockout frequency from the ledger (times balance hit 0).
    const stockoutRows = await this.stockMovementsRepository
      .createQueryBuilder('sm')
      .select('sm.inventoryItemId', 'itemId')
      .addSelect('COUNT(*)', 'stockouts')
      .where('sm.organisationId = :organisationId', { organisationId })
      .andWhere('sm.deletedAt IS NULL')
      .andWhere('sm.balanceAfter = 0')
      .groupBy('sm.inventoryItemId')
      .getRawMany();

    // Cost-price trend: first vs latest unit_cost per item (from ledger).
    const costRows = await this.stockMovementsRepository
      .createQueryBuilder('sm')
      .select('sm.inventoryItemId', 'itemId')
      .addSelect('sm.unitCost', 'unitCost')
      .where('sm.organisationId = :organisationId', { organisationId })
      .andWhere('sm.deletedAt IS NULL')
      .andWhere('sm.unitCost IS NOT NULL')
      .orderBy('sm.createdAt', 'ASC')
      .getRawMany();

    // Resolve names for any referenced items.
    const itemIds = [
      ...new Set([
        ...stockoutRows.map((r) => r.itemId),
        ...costRows.map((r) => r.itemId),
      ]),
    ];
    const nameById = new Map<string, string>();
    if (itemIds.length) {
      const named = await this.inventoryItemsRepository
        .createQueryBuilder('item')
        .select(['item.id AS id', 'item.name AS name'])
        .where('item.id IN (:...itemIds)', { itemIds })
        .getRawMany();
      for (const n of named) nameById.set(n.id, n.name);
    }

    const stockouts = stockoutRows
      .map((r) => ({
        name: nameById.get(r.itemId) ?? 'Unknown',
        stockouts: parseInt(r.stockouts ?? '0', 10),
      }))
      .sort((a, b) => b.stockouts - a.stockouts)
      .slice(0, 10);

    // first/latest cost per item
    const costByItem = new Map<string, { first: number; latest: number }>();
    for (const r of costRows) {
      const cost = parseFloat(r.unitCost ?? '0');
      const e = costByItem.get(r.itemId);
      if (!e) costByItem.set(r.itemId, { first: cost, latest: cost });
      else e.latest = cost;
    }
    const costTrend = [...costByItem.entries()]
      .filter(([, v]) => v.first !== v.latest)
      .map(([itemId, v]) => ({
        name: nameById.get(itemId) ?? 'Unknown',
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
  async getSupplierPerformance(organisationId: string) {
    const leadRows = await this.purchaseOrdersRepository
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
      .groupBy('po.supplierId')
      .getRawMany();

    const leadTimeBySupplier = leadRows
      .map((r) => ({
        supplierId: r.supplierId,
        name: r.name ?? 'Unknown',
        receivedPos: parseInt(r.receivedPos ?? '0', 10),
        avgLeadDays: Math.round(parseFloat(r.avgLeadDays ?? '0') * 10) / 10,
      }))
      .sort((a, b) => a.avgLeadDays - b.avgLeadDays);

    const priceRows = await this.purchaseOrderItemsRepository
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
      .having('MIN(poi.unitPrice) <> MAX(poi.unitPrice)')
      .getRawMany();

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
  ) {
    const activeAdmissions = await this.admissionsRepository
      .createQueryBuilder('a')
      .where('a.organisationId = :organisationId', { organisationId })
      .andWhere('a.deletedAt IS NULL')
      .andWhere("a.status = 'ACTIVE'")
      .getCount();

    const occupiedRaw = await this.admissionsRepository
      .createQueryBuilder('a')
      .select('COUNT(DISTINCT a.roomId)', 'cnt')
      .where('a.organisationId = :organisationId', { organisationId })
      .andWhere('a.deletedAt IS NULL')
      .andWhere("a.status = 'ACTIVE'")
      .getRawOne();
    const occupiedRooms = parseInt(occupiedRaw?.cnt ?? '0', 10);

    const totalRooms = await this.roomsRepository
      .createQueryBuilder('r')
      .where('r.organisationId = :organisationId', { organisationId })
      .andWhere('r.deletedAt IS NULL')
      .andWhere('r.is_active = true')
      .getCount();

    const losRaw = await this.admissionsRepository
      .createQueryBuilder('a')
      .select(
        'AVG(EXTRACT(EPOCH FROM (a.actual_check_out_date - a.check_in_date)) / 86400.0)',
        'avgDays',
      )
      .where('a.organisationId = :organisationId', { organisationId })
      .andWhere('a.deletedAt IS NULL')
      .andWhere("a.status = 'DISCHARGED'")
      .andWhere('a.actual_check_out_date IS NOT NULL')
      .getRawOne();

    const admQb = this.admissionsRepository
      .createQueryBuilder('a')
      .where('a.organisationId = :organisationId', { organisationId })
      .andWhere('a.deletedAt IS NULL')
      .andWhere("a.status <> 'CANCELLED'");
    if (startDate) admQb.andWhere('a.check_in_date >= :startDate', { startDate });
    if (endDate) admQb.andWhere('a.check_in_date <= :endDate', { endDate });
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

    const usageEvents = events.map(e => {
      return this.usageEventRepository.create({
        organisation: organisationId ? { id: organisationId } : undefined,
        user: userId ? { id: userId } : undefined,
        eventType: e.eventType,
        screenName: e.screenName,
        metadata: e.metadata,
        platform: e.platform,
        appVersion: e.appVersion,
        sessionId: e.sessionId,
        occurredAt: e.occurredAt ? new Date(e.occurredAt) : new Date(),
      });
    });

    await this.usageEventRepository.save(usageEvents);
    return { success: true, count: usageEvents.length };
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
    const topMedicinesRaw = await this.ordersRepository.createQueryBuilder('o')
      .innerJoin('o.items', 'item')
      .select('item.productName', 'name')
      .addSelect('SUM(item.quantity)', 'totalQuantity')
      .addSelect('SUM(item.totalAmount)', 'totalRevenue')
      .where(`o.createdAt >= CURRENT_DATE - INTERVAL '${days} days'`)
      .andWhere("o.status NOT IN ('cancelled', 'returned')")
      .groupBy('item.productName')
      .orderBy('SUM(item.quantity)', 'DESC')
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
    };
  }
}
