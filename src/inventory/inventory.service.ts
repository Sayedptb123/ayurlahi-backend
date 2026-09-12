import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { InventoryItemMaster } from './entities/inventory-item-master.entity';
import { InventoryBranchStock } from './entities/inventory-branch-stock.entity';
import {
  StockMovement,
  StockMovementType,
} from './entities/stock-movement.entity';
import { Branch } from '../branches/entities/branch.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { Product } from '../products/entities/product.entity';
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
} from './dto/create-inventory-item.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { BranchVisibilityService } from '../branch-visibility/branch-visibility.service';

// ADR-005 Step 3 — the shape every read endpoint returns, unchanged from
// the pre-cutover InventoryItem entity's fields (see
// Step3_Inventory_Service_Cutover_Implementation_Plan.md §0.2 / §4).
// Existing frontend (InventoryScreen.tsx etc.) is not touched this step
// and must keep working against this exact shape.
export interface LegacyShapedItem {
  id: string;
  organisationId: string;
  name: string;
  sku: string | null;
  description: string | null;
  category: string | null;
  productId: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  hsnCode: string | null;
  gstRate: number | null;
  unit: string;
  currentStock: number;
  minStockLevel: number;
  unitPrice: number | null;
  costPrice: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItemMaster)
    private readonly masterRepository: Repository<InventoryItemMaster>,
    @InjectRepository(InventoryBranchStock)
    private readonly stockRepository: Repository<InventoryBranchStock>,
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
    @InjectRepository(OrganisationUser)
    private readonly orgUserRepository: Repository<OrganisationUser>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly notificationsService: NotificationsService,
    private readonly branchVisibilityService: BranchVisibilityService,
  ) {}

  // --- shared helpers ---------------------------------------------------

  private toLegacyShape(master: InventoryItemMaster, stock: {
    currentStock: number;
    minStockLevel: number;
    batchNumber: string | null;
    expiryDate: string | null;
  }): LegacyShapedItem {
    return {
      id: master.id,
      organisationId: master.organisationId,
      name: master.name,
      sku: master.sku,
      description: master.description,
      category: master.category,
      productId: master.productId,
      batchNumber: stock.batchNumber,
      expiryDate: stock.expiryDate,
      hsnCode: master.hsnCode,
      gstRate: master.gstRate,
      unit: master.unit,
      currentStock: stock.currentStock,
      minStockLevel: stock.minStockLevel,
      unitPrice: master.unitPrice,
      costPrice: master.costPrice,
      isActive: master.isActive,
      createdAt: master.createdAt,
      updatedAt: master.updatedAt,
      deletedAt: master.deletedAt,
    };
  }

  /** Aggregates one master's branch-stock rows into a single legacy-shaped
   * view: sums current_stock/min_stock_level across the given rows (a
   * meaningful "total" for both); batch/expiry only carry over when
   * exactly one row is being aggregated (per-batch fields don't have a
   * sensible combined value across branches). */
  private aggregateStock(rows: InventoryBranchStock[]) {
    if (rows.length === 0) {
      return { currentStock: 0, minStockLevel: 10, batchNumber: null, expiryDate: null };
    }
    if (rows.length === 1) {
      return {
        currentStock: rows[0].currentStock,
        minStockLevel: rows[0].minStockLevel,
        batchNumber: rows[0].batchNumber,
        expiryDate: rows[0].expiryDate,
      };
    }
    return {
      currentStock: rows.reduce((sum, r) => sum + r.currentStock, 0),
      minStockLevel: rows.reduce((sum, r) => sum + r.minStockLevel, 0),
      batchNumber: null,
      expiryDate: null,
    };
  }

  /**
   * Read-side branch resolution. Returns:
   *   null      -- no filter; read/sum across everything the org has. This
   *                is the correct result both when the caller can see
   *                everything (org-wide role) AND when the org isn't
   *                per-branch at all -- for a 'shared' org, a client-sent
   *                branchId is cosmetic (whatever the global branch
   *                switcher happens to have selected, e.g. PMS while it's
   *                still on 'shared' despite having 3 real branches) and
   *                MUST be ignored, never used to filter, or a UI
   *                selection could hide an org's real data. Found and
   *                fixed 2026-09-12, same root cause class as the
   *                write-side bug in a2fb655 -- "not per-branch" was being
   *                conflated with "no branchId was requested".
   *   string[]  -- exactly which branch id(s) to filter to (either the
   *                caller's one validated request, or their full visible
   *                set when none was requested). Empty is a valid,
   *                deliberate fail-closed result.
   */
  private async resolveReadBranchIds(
    organisationId: string,
    userId: string | undefined,
    role: string | undefined,
    requestedBranchId?: string,
  ): Promise<string[] | null> {
    const visible = await this.branchVisibilityService.resolveVisibleBranchIdsForInventory(
      userId,
      organisationId,
      role,
    );
    if (visible === null) return null;

    if (requestedBranchId) {
      const branch = await this.branchesRepository.findOne({
        where: { id: requestedBranchId, organisationId, deletedAt: IsNull() },
      });
      if (!branch) throw new NotFoundException('Branch not found for this organisation');
      if (!visible.includes(requestedBranchId)) {
        throw new ForbiddenException('You do not have access to this branch');
      }
      return [requestedBranchId];
    }
    return visible;
  }

  private async assertProductExists(productId: string): Promise<void> {
    const product = await this.productRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new BadRequestException('Linked marketplace product not found');
    }
  }

  /** ADR-005 Step 3 -- writes exclusively to stock_movements' new columns
   * (branchId / inventoryBranchStockId). Never touches inventoryItemId --
   * that stays legacy-only, per the authoritative-source rule. Best-effort
   * (matches the pre-cutover method's behavior): a ledger failure must
   * never block the stock change itself. */
  private async recordMovement(m: {
    organisationId: string;
    branchId: string | null;
    inventoryBranchStockId: string;
    movementType: StockMovementType;
    quantity: number;
    balanceAfter: number;
    unitCost?: number | null;
    referenceType?: string | null;
    referenceId?: string | null;
    note?: string | null;
  }): Promise<void> {
    try {
      if (m.quantity === 0) return;
      await this.stockMovementRepository.save(
        this.stockMovementRepository.create({
          organisationId: m.organisationId,
          branchId: m.branchId,
          inventoryBranchStockId: m.inventoryBranchStockId,
          inventoryItemId: null,
          movementType: m.movementType,
          quantity: m.quantity,
          balanceAfter: m.balanceAfter,
          unitCost: m.unitCost ?? null,
          referenceType: m.referenceType ?? null,
          referenceId: m.referenceId ?? null,
          note: m.note ?? null,
        }),
      );
    } catch {
      /* ledger is best-effort; never block the stock change */
    }
  }

  private async lowStockNotify(
    organisationId: string,
    itemName: string,
    stock: InventoryBranchStock,
  ): Promise<void> {
    if (stock.currentStock > stock.minStockLevel) return;
    const orgUsers = await this.orgUserRepository.find({
      where: { organisationId, role: In(['OWNER', 'MANAGER', 'ADMIN']), isActive: true },
    });
    const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
    if (userIds.length === 0) return;

    let branchLabel = '';
    if (stock.branchId) {
      const branch = await this.branchesRepository.findOne({ where: { id: stock.branchId } });
      if (branch) branchLabel = ` (${branch.name})`;
    }

    const isOutOfStock = stock.currentStock === 0;
    this.notificationsService.sendToUsers({
      userIds,
      title: isOutOfStock ? 'Out of Stock' : 'Low Stock Alert',
      body: isOutOfStock
        ? `${itemName}${branchLabel} is completely out of stock. Please reorder immediately.`
        : `${itemName}${branchLabel} is running low (${stock.currentStock} remaining)`,
      data: { inventoryItemId: stock.itemMasterId, type: isOutOfStock ? 'out_of_stock' : 'low_stock' },
    }).catch(() => {});
  }

  // --- public API ---------------------------------------------------

  async create(
    organisationId: string,
    dto: CreateInventoryItemDto,
    userId: string,
    role: string,
  ): Promise<LegacyShapedItem> {
    if (dto.productId) {
      await this.assertProductExists(dto.productId);
    }
    const branchId = await this.branchVisibilityService.resolveBranchIdForWrite(
      organisationId,
      userId,
      role,
      dto.branchId,
    );

    const master = this.masterRepository.create({
      organisationId,
      name: dto.name,
      sku: dto.sku ?? null,
      description: dto.description ?? null,
      category: dto.category ?? null,
      unit: dto.unit,
      unitPrice: dto.unitPrice ?? null,
      costPrice: dto.costPrice ?? null,
      hsnCode: dto.hsnCode ?? null,
      gstRate: dto.gstRate ?? null,
      productId: dto.productId ?? null,
      isActive: true,
      legacyItemId: null,
    });
    let savedMaster: InventoryItemMaster;
    try {
      savedMaster = await this.masterRepository.save(master);
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException(
          'An item with this name or SKU already exists — edit the existing item instead of creating a duplicate.',
        );
      }
      throw err;
    }

    const stock = await this.stockRepository.save(
      this.stockRepository.create({
        organisationId,
        branchId,
        itemMasterId: savedMaster.id,
        currentStock: dto.currentStock ?? 0,
        minStockLevel: dto.minStockLevel ?? 10,
        batchNumber: dto.batchNumber ?? null,
        expiryDate: dto.expiryDate ?? null,
      }),
    );

    if (stock.currentStock > 0) {
      await this.recordMovement({
        organisationId,
        branchId,
        inventoryBranchStockId: stock.id,
        movementType: 'initial',
        quantity: stock.currentStock,
        balanceAfter: stock.currentStock,
        unitCost: savedMaster.costPrice ?? savedMaster.unitPrice ?? null,
        referenceType: 'manual',
        note: 'Opening stock',
      });
    }

    return this.toLegacyShape(savedMaster, stock);
  }

  async findAll(
    organisationId: string,
    query: { page?: number; limit?: number; category?: string; isActive?: boolean; branchId?: string },
    userId: string | undefined,
    role: string | undefined,
  ): Promise<{
    data: LegacyShapedItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.masterRepository
      .createQueryBuilder('m')
      .where('m.organisation_id = :organisationId', { organisationId });
    if (query?.category) qb.andWhere('m.category = :category', { category: query.category });
    if (query?.isActive !== undefined) qb.andWhere('m.is_active = :isActive', { isActive: query.isActive });

    const total = await qb.getCount();
    qb.skip(skip).take(limit).orderBy('m.name', 'ASC');
    const masters = await qb.getMany();
    if (masters.length === 0) {
      return { data: [], pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    const masterIds = masters.map((m) => m.id);
    const stockQb = this.stockRepository
      .createQueryBuilder('s')
      .where('s.item_master_id IN (:...masterIds)', { masterIds })
      .andWhere('s.deleted_at IS NULL');

    const branchIds = await this.resolveReadBranchIds(organisationId, userId, role, query?.branchId);
    if (branchIds !== null) {
      // Per-branch org: an empty array correctly sums to zero for every
      // item (Invariant 2), not everything.
      if (branchIds.length === 0) {
        const data = masters.map((m) => this.toLegacyShape(m, this.aggregateStock([])));
        return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
      }
      stockQb.andWhere('s.branch_id IN (:...branchIds)', { branchIds });
    }
    // branchIds === null: not a per-branch org (any requested branchId was
    // cosmetic and is ignored here), or an org-wide leadership role -- sum
    // across every branch the org actually has (or its one branch-less
    // row).

    const stockRows = await stockQb.getMany();
    const byMaster = new Map<string, InventoryBranchStock[]>();
    for (const row of stockRows) {
      const list = byMaster.get(row.itemMasterId) ?? [];
      list.push(row);
      byMaster.set(row.itemMasterId, list);
    }

    const data = masters.map((m) => this.toLegacyShape(m, this.aggregateStock(byMaster.get(m.id) ?? [])));
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(
    organisationId: string,
    id: string,
    userId?: string,
    role?: string,
    branchId?: string,
  ): Promise<LegacyShapedItem> {
    const master = await this.masterRepository.findOne({ where: { id, organisationId } });
    if (!master) throw new NotFoundException(`Inventory item with ID ${id} not found`);

    const stockQb = this.stockRepository
      .createQueryBuilder('s')
      .where('s.item_master_id = :id', { id })
      .andWhere('s.deleted_at IS NULL');

    const branchIds = await this.resolveReadBranchIds(organisationId, userId, role, branchId);
    if (branchIds !== null) {
      if (branchIds.length === 0) return this.toLegacyShape(master, this.aggregateStock([]));
      stockQb.andWhere('s.branch_id IN (:...branchIds)', { branchIds });
    }

    const rows = await stockQb.getMany();
    return this.toLegacyShape(master, this.aggregateStock(rows));
  }

  async update(
    organisationId: string,
    id: string,
    dto: UpdateInventoryItemDto,
    userId: string,
    role: string,
  ): Promise<LegacyShapedItem> {
    const master = await this.masterRepository.findOne({ where: { id, organisationId } });
    if (!master) throw new NotFoundException(`Inventory item with ID ${id} not found`);

    if (dto.productId) await this.assertProductExists(dto.productId);

    // Catalog fields -- affect every branch.
    if (dto.name !== undefined) master.name = dto.name;
    if (dto.sku !== undefined) master.sku = dto.sku;
    if (dto.description !== undefined) master.description = dto.description;
    if (dto.category !== undefined) master.category = dto.category;
    if (dto.productId !== undefined) master.productId = dto.productId;
    if (dto.hsnCode !== undefined) master.hsnCode = dto.hsnCode;
    if (dto.gstRate !== undefined) master.gstRate = dto.gstRate;
    if (dto.unit !== undefined) master.unit = dto.unit;
    if (dto.unitPrice !== undefined) master.unitPrice = dto.unitPrice;
    if (dto.costPrice !== undefined) master.costPrice = dto.costPrice;
    if (dto.isActive !== undefined) master.isActive = dto.isActive;
    let savedMaster: InventoryItemMaster;
    try {
      savedMaster = await this.masterRepository.save(master);
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException('An item with this name or SKU already exists for this organisation.');
      }
      throw err;
    }

    // Stock fields -- affect exactly one branch, resolved the same way
    // every other write path resolves it.
    const branchId = await this.branchVisibilityService.resolveBranchIdForWrite(
      organisationId,
      userId,
      role,
      dto.branchId,
    );
    let stock = await this.stockRepository.findOne({
      where: { itemMasterId: id, branchId: branchId ?? IsNull() },
    });
    if (!stock) {
      stock = this.stockRepository.create({
        organisationId,
        branchId,
        itemMasterId: id,
        currentStock: 0,
        minStockLevel: 10,
      });
    }
    const previousStock = stock.currentStock;
    if (dto.currentStock !== undefined) stock.currentStock = dto.currentStock;
    if (dto.minStockLevel !== undefined) stock.minStockLevel = dto.minStockLevel;
    if (dto.batchNumber !== undefined) stock.batchNumber = dto.batchNumber;
    if (dto.expiryDate !== undefined) stock.expiryDate = dto.expiryDate;
    const savedStock = await this.stockRepository.save(stock);

    const delta = savedStock.currentStock - previousStock;
    if (delta !== 0) {
      await this.recordMovement({
        organisationId,
        branchId,
        inventoryBranchStockId: savedStock.id,
        movementType: 'manual_adjustment',
        quantity: delta,
        balanceAfter: savedStock.currentStock,
        unitCost: savedMaster.costPrice ?? savedMaster.unitPrice ?? null,
        referenceType: 'manual',
      });
      await this.lowStockNotify(organisationId, savedMaster.name, savedStock);
    }

    return this.toLegacyShape(savedMaster, savedStock);
  }

  async remove(
    organisationId: string,
    id: string,
    userId: string,
    role: string,
    branchId?: string,
  ): Promise<void> {
    const master = await this.masterRepository.findOne({ where: { id, organisationId } });
    if (!master) throw new NotFoundException(`Inventory item with ID ${id} not found`);

    const resolvedBranchId = await this.branchVisibilityService.resolveBranchIdForWrite(
      organisationId,
      userId,
      role,
      branchId,
    );
    const stock = await this.stockRepository.findOne({
      where: { itemMasterId: id, branchId: resolvedBranchId ?? IsNull() },
    });
    if (stock) await this.stockRepository.softDelete(stock.id);

    const remaining = await this.stockRepository.count({
      where: { itemMasterId: id, deletedAt: IsNull() },
    });
    if (remaining === 0) {
      await this.masterRepository.softDelete(master.id);
    }
  }

  async checkLowStock(
    organisationId: string,
    userId: string | undefined,
    role: string | undefined,
    branchId?: string,
  ): Promise<LegacyShapedItem[]> {
    const { data } = await this.findAll(organisationId, { limit: 100000, isActive: true, branchId }, userId, role);
    return data.filter((item) => item.currentStock <= item.minStockLevel);
  }

  /**
   * ADR-005 Step 3 — stock-in for a delivered marketplace order. `branchId`
   * is required at the type level as `string | null`: the caller
   * (OrdersService, §6 of the implementation plan) must have already
   * resolved it (order.branchId directly, a genuinely branch-less org's
   * null, or the explicit legacy-order primary-branch fallback) --
   * addStock never re-derives or re-validates it from a request, since it
   * only ever receives values this codebase already resolved, never
   * external input.
   */
  async addStock(
    organisationId: string,
    branchId: string | null,
    items: Array<{
      productId?: string | null;
      sku?: string;
      name: string;
      quantity: number;
      unitPrice: number;
      unit?: string;
      orderId?: string | null;
      movementNote?: string | null;
    }>,
  ): Promise<void> {
    for (const item of items) {
      let master: InventoryItemMaster | null = null;

      if (item.productId) {
        master = await this.masterRepository.findOne({ where: { organisationId, productId: item.productId } });
      }
      if (!master && item.sku) {
        master = await this.masterRepository.findOne({ where: { organisationId, sku: item.sku } });
        if (master && item.productId && !master.productId) {
          master.productId = item.productId;
        }
      }

      if (!master) {
        master = this.masterRepository.create({
          organisationId,
          name: item.name,
          sku: item.sku ?? null,
          productId: item.productId ?? null,
          unit: item.unit || 'Unit',
          unitPrice: item.unitPrice,
          costPrice: item.unitPrice,
          isActive: true,
          legacyItemId: null,
        });
      } else {
        master.unitPrice = item.unitPrice; // latest purchase price, matches pre-cutover behavior
      }
      master = await this.masterRepository.save(master);

      let stock = await this.stockRepository.findOne({
        where: { itemMasterId: master.id, branchId: branchId ?? IsNull() },
      });
      if (!stock) {
        stock = this.stockRepository.create({
          organisationId,
          branchId,
          itemMasterId: master.id,
          currentStock: 0,
          minStockLevel: 10,
        });
      }
      stock.currentStock += item.quantity;
      stock = await this.stockRepository.save(stock);

      await this.recordMovement({
        organisationId,
        branchId,
        inventoryBranchStockId: stock.id,
        movementType: 'order_delivery',
        quantity: item.quantity,
        balanceAfter: stock.currentStock,
        unitCost: item.unitPrice,
        referenceType: 'order',
        referenceId: item.orderId ?? null,
        note: item.movementNote ?? null,
      });
    }
  }

  /** Merges legacy movements (pre-cutover, referenced via
   * inventoryItemId/legacyItemId) with new movements (referenced via
   * inventoryBranchStockId) so an item's full history survives the
   * cutover point, not just what happened after it. */
  async getMovements(
    organisationId: string,
    id: string,
    userId?: string,
    role?: string,
    branchId?: string,
  ): Promise<StockMovement[]> {
    const master = await this.masterRepository.findOne({ where: { id, organisationId } });
    if (!master) throw new NotFoundException(`Inventory item with ID ${id} not found`);

    const branchIds = await this.resolveReadBranchIds(organisationId, userId, role, branchId);

    const stockQb = this.stockRepository
      .createQueryBuilder('s')
      .where('s.item_master_id = :id', { id });
    if (branchIds !== null) stockQb.andWhere('s.branch_id IN (:...branchIds)', { branchIds: branchIds.length > 0 ? branchIds : ['00000000-0000-0000-0000-000000000000'] });
    const stockRows = await stockQb.getMany();
    const stockIds = stockRows.map((s) => s.id);

    const qb = this.stockMovementRepository
      .createQueryBuilder('sm')
      .where('sm.organisation_id = :organisationId', { organisationId })
      .andWhere(
        master.legacyItemId
          ? '(sm.inventory_branch_stock_id IN (:...stockIds) OR sm.inventory_item_id = :legacyId)'
          : 'sm.inventory_branch_stock_id IN (:...stockIds)',
        { stockIds: stockIds.length > 0 ? stockIds : ['00000000-0000-0000-0000-000000000000'], legacyId: master.legacyItemId },
      )
      .orderBy('sm.created_at', 'DESC')
      .take(100);

    return qb.getMany();
  }
}
