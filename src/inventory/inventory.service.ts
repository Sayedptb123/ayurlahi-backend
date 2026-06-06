import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import {
  StockMovement,
  StockMovementType,
} from './entities/stock-movement.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { Product } from '../products/entities/product.entity';
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
} from './dto/create-inventory-item.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(OrganisationUser)
    private readonly orgUserRepository: Repository<OrganisationUser>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly notificationsService: NotificationsService,
  ) { }

  /**
   * Phase 24C.1 — append a stock-movement ledger row. Best-effort: a ledger
   * failure must never break the stock change itself, so errors are swallowed.
   */
  private async recordMovement(m: {
    organisationId: string;
    inventoryItemId: string;
    movementType: StockMovementType;
    quantity: number; // signed delta
    balanceAfter: number;
    unitCost?: number | null;
    referenceType?: string | null;
    referenceId?: string | null;
    note?: string | null;
  }): Promise<void> {
    try {
      if (m.quantity === 0) return; // nothing changed
      await this.stockMovementRepository.save(
        this.stockMovementRepository.create({
          organisationId: m.organisationId,
          inventoryItemId: m.inventoryItemId,
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

  /** Phase 24C.1 — movement history for one item (newest first), org-scoped. */
  async getMovements(
    organisationId: string,
    id: string,
  ): Promise<StockMovement[]> {
    await this.findOne(organisationId, id); // enforces org ownership / 404
    return this.stockMovementRepository.find({
      where: { organisationId, inventoryItemId: id },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  /**
   * Phase 24A.0 — verify a linked marketplace product exists (and isn't
   * soft-deleted; TypeORM excludes deleted rows by default). Only called when a
   * productId is actually supplied; null/undefined leaves the item unlinked.
   */
  private async assertProductExists(productId: string): Promise<void> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });
    if (!product) {
      throw new BadRequestException('Linked marketplace product not found');
    }
  }

  async create(
    organisationId: string,
    createInventoryItemDto: CreateInventoryItemDto,
  ): Promise<InventoryItem> {
    if (createInventoryItemDto.productId) {
      await this.assertProductExists(createInventoryItemDto.productId);
    }
    const item = this.inventoryRepository.create({
      ...createInventoryItemDto,
      organisationId,
    });
    const saved = await this.inventoryRepository.save(item);
    // Phase 24C.1 — opening balance as the first ledger entry
    if (saved.currentStock > 0) {
      await this.recordMovement({
        organisationId,
        inventoryItemId: saved.id,
        movementType: 'initial',
        quantity: saved.currentStock,
        balanceAfter: saved.currentStock,
        unitCost: saved.costPrice ?? saved.unitPrice ?? null,
        referenceType: 'manual',
        note: 'Opening stock',
      });
    }
    return saved;
  }

  async findAll(organisationId: string): Promise<InventoryItem[]> {
    return await this.inventoryRepository.find({
      where: { organisationId },
      order: { name: 'ASC' },
    });
  }

  async findOne(organisationId: string, id: string): Promise<InventoryItem> {
    const item = await this.inventoryRepository.findOne({
      where: { id, organisationId },
    });

    if (!item) {
      throw new NotFoundException(`Inventory item with ID ${id} not found`);
    }

    return item;
  }

  async update(
    organisationId: string,
    id: string,
    updateInventoryItemDto: UpdateInventoryItemDto,
  ): Promise<InventoryItem> {
    const item = await this.findOne(organisationId, id);

    if (updateInventoryItemDto.productId) {
      await this.assertProductExists(updateInventoryItemDto.productId);
    }

    const previousStock = item.currentStock;
    Object.assign(item, updateInventoryItemDto);
    const saved = await this.inventoryRepository.save(item);

    // Phase 24C.1 — record a manual adjustment for any stock delta
    const delta = saved.currentStock - previousStock;
    if (delta !== 0) {
      await this.recordMovement({
        organisationId,
        inventoryItemId: saved.id,
        movementType: 'manual_adjustment',
        quantity: delta,
        balanceAfter: saved.currentStock,
        unitCost: saved.costPrice ?? saved.unitPrice ?? null,
        referenceType: 'manual',
      });
    }

    // Send stock alert if current stock is at or below minimum
    if (saved.currentStock <= saved.minStockLevel) {
      this.orgUserRepository
        .find({ where: { organisationId, role: In(['OWNER', 'MANAGER', 'ADMIN']), isActive: true } })
        .then((orgUsers) => {
          const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
          if (userIds.length > 0) {
            const isOutOfStock = saved.currentStock === 0;
            this.notificationsService.sendToUsers({
              userIds,
              title: isOutOfStock ? 'Out of Stock' : 'Low Stock Alert',
              body: isOutOfStock
                ? `${saved.name} is completely out of stock. Please reorder immediately.`
                : `${saved.name} is running low (${saved.currentStock} ${saved.unit ?? 'units'} remaining)`,
              data: { inventoryItemId: saved.id, type: isOutOfStock ? 'out_of_stock' : 'low_stock' },
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }

    return saved;
  }

  async remove(organisationId: string, id: string): Promise<void> {
    const item = await this.findOne(organisationId, id);
    await this.inventoryRepository.softDelete(item.id);
  }

  async checkLowStock(organisationId: string): Promise<InventoryItem[]> {
    return await this.inventoryRepository
      .createQueryBuilder('item')
      .where('item.organisation_id = :organisationId', { organisationId })
      .andWhere('item.current_stock <= item.min_stock_level')
      .getMany();
  }

  /**
   * Phase 24A.2 — stock-in for a delivered marketplace order. Matches the
   * clinic's inventory by the authoritative `product_id` link first (so stock
   * lands on the same item the "Order Now" came from, 24A.1), then falls back to
   * SKU, then auto-creates. When matched by SKU, backfills the product link.
   */
  async addStock(
    organisationId: string,
    items: Array<{
      productId?: string | null;
      sku?: string;
      name: string;
      quantity: number;
      unitPrice: number;
      unit?: string;
      orderId?: string | null;
    }>,
  ): Promise<void> {
    for (const item of items) {
      let inventoryItem: InventoryItem | null = null;

      // 1. Prefer the marketplace product link (Phase 24A).
      if (item.productId) {
        inventoryItem = await this.inventoryRepository.findOne({
          where: { organisationId, productId: item.productId },
        });
      }

      // 2. Fall back to SKU; backfill the link if it was unset.
      if (!inventoryItem && item.sku) {
        inventoryItem = await this.inventoryRepository.findOne({
          where: { organisationId, sku: item.sku },
        });
        if (inventoryItem && item.productId && !inventoryItem.productId) {
          inventoryItem.productId = item.productId;
        }
      }

      if (inventoryItem) {
        inventoryItem.currentStock += item.quantity;
        // Keep latest purchase price (simple; not weighted average)
        inventoryItem.unitPrice = item.unitPrice;
        await this.inventoryRepository.save(inventoryItem);
      } else {
        // 3. Auto-create, carrying the product link forward.
        inventoryItem = this.inventoryRepository.create({
          organisationId,
          name: item.name,
          sku: item.sku,
          productId: item.productId ?? null,
          currentStock: item.quantity,
          unitPrice: item.unitPrice,
          unit: item.unit || 'Unit',
          minStockLevel: 10,
          costPrice: item.unitPrice,
        });
        await this.inventoryRepository.save(inventoryItem);
      }

      // Phase 24C.1 — ledger the delivery stock-in
      await this.recordMovement({
        organisationId,
        inventoryItemId: inventoryItem.id,
        movementType: 'order_delivery',
        quantity: item.quantity,
        balanceAfter: inventoryItem.currentStock,
        unitCost: item.unitPrice,
        referenceType: 'order',
        referenceId: item.orderId ?? null,
      });
    }
  }
}
