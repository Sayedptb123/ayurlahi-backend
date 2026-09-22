import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, IsNull } from 'typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './dto/create-purchase-order.dto';
import { isLegalPoTransition } from './purchase-order-transitions';
import { InventoryItemMaster } from '../inventory/entities/inventory-item-master.entity';
import { InventoryBranchStock } from '../inventory/entities/inventory-branch-stock.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';
import { BranchVisibilityService } from '../branch-visibility/branch-visibility.service';

// T26: receiving a PO mutates inventory (unlike create/send/cancel, which
// don't touch stock), so it gets the stricter of the two authorization tiers
// already established in this codebase -- reusing the exact OWNER/MANAGER/ADMIN
// "elevated access" grouping StaffService.getDefaultPermissions already uses
// for other inventory/billing/staff-sensitive capabilities (staff.service.ts),
// rather than inventing a new tier for this one action.
const PO_RECEIVE_ROLES = new Set(['OWNER', 'MANAGER', 'ADMIN']);

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly poRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly poItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(InventoryItemMaster)
    private readonly masterRepository: Repository<InventoryItemMaster>,
    @InjectRepository(InventoryBranchStock)
    private readonly stockRepository: Repository<InventoryBranchStock>,
    private readonly branchVisibilityService: BranchVisibilityService,
  ) {}

  async create(
    organisationId: string,
    createDto: CreatePurchaseOrderDto,
    userId: string,
    role: string,
  ): Promise<PurchaseOrder> {
    const branchId = await this.branchVisibilityService.resolveBranchIdForWrite(
      organisationId,
      userId,
      role,
      createDto.branchId,
    );

    const { items: itemsDto, branchId: _ignored, ...poData } = createDto;

    let totalAmount = 0;
    const items = itemsDto.map((itemDto) => {
      const totalPrice = itemDto.quantity * itemDto.unitPrice;
      totalAmount += totalPrice;
      return this.poItemRepository.create({
        ...itemDto,
        totalPrice,
      });
    });

    const po = this.poRepository.create({
      ...poData,
      organisationId,
      branchId,
      createdById: userId,
      totalAmount,
      items,
      status: 'draft',
    });

    return await this.poRepository.save(po);
  }

  async findAll(organisationId: string): Promise<PurchaseOrder[]> {
    return await this.poRepository.find({
      where: { organisationId },
      relations: ['supplier', 'items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(organisationId: string, id: string): Promise<PurchaseOrder> {
    const po = await this.poRepository.findOne({
      where: { id, organisationId },
      relations: ['supplier', 'items', 'items.item', 'items.itemMaster'],
    });

    if (!po) {
      throw new NotFoundException(`Purchase Order with ID ${id} not found`);
    }

    return po;
  }

  async update(
    organisationId: string,
    id: string,
    updateDto: UpdatePurchaseOrderDto,
    userId: string,
    role: string,
  ): Promise<PurchaseOrder> {
    const po = await this.findOne(organisationId, id);

    // T26: received/cancelled are terminal -- once stock has been received
    // (or the PO abandoned) nothing about it can be changed through this
    // endpoint, not just its status. A correction after receiving belongs
    // to a separate inventory-adjustment workflow, not a mutated PO.
    if (po.status === 'received' || po.status === 'cancelled') {
      throw new BadRequestException(
        `This purchase order is ${po.status} and can no longer be edited.`,
      );
    }

    if (updateDto.status && updateDto.status !== po.status) {
      if (!isLegalPoTransition(po.status, updateDto.status)) {
        throw new BadRequestException(
          `Cannot change purchase order status from '${po.status}' to '${updateDto.status}'.`,
        );
      }

      if (updateDto.status === 'received') {
        // Receiving mutates inventory and needs its own locked, re-checked
        // transaction (T25-style) -- handled entirely by this method,
        // including the final save, so it does not also fall through to
        // the generic Object.assign+save below.
        return this.receivePurchaseOrderAtomic(organisationId, id, userId, role);
      }
    }

    Object.assign(po, updateDto);
    return await this.poRepository.save(po);
  }

  // T26 (2026-09-16, scope/TRACKER.md): replaces the old receivePurchaseOrder(),
  // which opened its own transaction but operated on a `po` fetched via a plain
  // findOne() *before* that transaction started -- two simultaneous
  // PATCH {status:'received'} requests could both pass update()'s status
  // check and both reach here, crediting stock twice for one delivery.
  // Mirrors the lock-then-recheck pattern orders.service.ts uses for the
  // identical class of bug (T25, correctPackedOrder()): re-fetch the row
  // WITH a pessimistic write lock inside the transaction, and re-validate
  // status against that locked read, not the pre-transaction snapshot.
  private async receivePurchaseOrderAtomic(
    organisationId: string,
    id: string,
    userId: string,
    role: string,
  ): Promise<PurchaseOrder> {
    // Authorization checks don't depend on concurrent state, so they run
    // before acquiring the lock rather than inside the transaction.
    if (!PO_RECEIVE_ROLES.has((role || '').toUpperCase())) {
      throw new ForbiddenException(
        'Only an owner, manager, or admin can receive a purchase order.',
      );
    }

    const po = await this.findOne(organisationId, id);

    // T26: receiving is branch-scoped -- a user may only credit stock into
    // a branch they're actually authorized to operate on, using the same
    // null-means-org-wide / array-means-restricted-set contract already
    // established for every other inventory write path.
    const visibleBranchIds = await this.branchVisibilityService.resolveVisibleBranchIdsForInventory(
      userId,
      organisationId,
      role,
    );
    if (visibleBranchIds !== null && po.branchId && !visibleBranchIds.includes(po.branchId)) {
      throw new ForbiddenException('You do not have access to this branch.');
    }

    return this.poRepository.manager.transaction(async (manager) => {
      const poRepo = manager.getRepository(PurchaseOrder);
      const lockedPo = await poRepo.findOne({
        where: { id, organisationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedPo) {
        throw new NotFoundException(`Purchase Order with ID ${id} not found`);
      }
      // The authoritative guard -- re-checked against the locked read, not
      // the pre-transaction `po` above, which is what actually closes the
      // race: a second concurrent request blocks on the lock until the
      // first commits, then sees status is no longer 'sent' here and is
      // rejected instead of double-crediting stock.
      if (lockedPo.status !== 'sent') {
        throw new BadRequestException(
          `Cannot receive a purchase order with status '${lockedPo.status}'.`,
        );
      }

      // A pessimistic lock can't be combined with an eager relations join
      // (same TypeORM constraint orders.service.ts works around for T25) --
      // fetch items separately, scoped to this PO.
      const itemRepo = manager.getRepository(PurchaseOrderItem);
      const items = await itemRepo.find({ where: { purchaseOrderId: lockedPo.id } });

      await this.creditStockForReceipt(manager, lockedPo, items);

      lockedPo.status = 'received';
      lockedPo.receivedAt = new Date(); // Phase 24B.3 — capture receipt time
      return poRepo.save(lockedPo);
    });
  }

  // ADR-005 Step 3 -- resolves/creates against the new item-master +
  // branch-stock model (po.branchId, already resolved at create time --
  // never re-resolved here). item.itemId (legacy) is left untouched;
  // item.itemMasterId is what this method actually acts on.
  private async creditStockForReceipt(
    manager: EntityManager,
    po: PurchaseOrder,
    items: PurchaseOrderItem[],
  ): Promise<void> {
    for (const item of items) {
      if (item.itemMasterId) {
        const master = await manager.findOne(InventoryItemMaster, {
          where: { id: item.itemMasterId },
        });
        if (master) {
          master.costPrice = item.unitPrice;
          await manager.save(master);

          let stock = await manager.findOne(InventoryBranchStock, {
            where: { itemMasterId: master.id, branchId: po.branchId ?? IsNull() },
          });
          if (!stock) {
            stock = manager.create(InventoryBranchStock, {
              organisationId: po.organisationId,
              branchId: po.branchId,
              itemMasterId: master.id,
              currentStock: 0,
              minStockLevel: 10,
            });
          }
          stock.currentStock += item.quantity;
          await manager.save(stock);

          await manager.save(
            manager.create(StockMovement, {
              organisationId: po.organisationId,
              branchId: po.branchId,
              inventoryBranchStockId: stock.id,
              inventoryItemId: null,
              movementType: 'purchase_receipt',
              quantity: item.quantity,
              balanceAfter: stock.currentStock,
              unitCost: item.unitPrice,
              referenceType: 'purchase_order',
              referenceId: po.id,
            }),
          );
        }
      } else if (item.itemId) {
        // Legacy path -- kept only so an already-in-flight PO created
        // before this cutover (referencing the old inventory_items
        // table) still receives correctly. No new PO populates itemId.
        const inventoryItem = await manager.findOne(InventoryItem, {
          where: { id: item.itemId },
        });
        if (inventoryItem) {
          inventoryItem.currentStock += item.quantity;
          inventoryItem.costPrice = item.unitPrice;
          await manager.save(inventoryItem);
          await manager.save(
            manager.create(StockMovement, {
              organisationId: po.organisationId,
              inventoryItemId: inventoryItem.id,
              movementType: 'purchase_receipt',
              quantity: item.quantity,
              balanceAfter: inventoryItem.currentStock,
              unitCost: item.unitPrice,
              referenceType: 'purchase_order',
              referenceId: po.id,
            }),
          );
        }
      }

      item.receivedQuantity = item.quantity;
      await manager.save(item);
    }
  }

  async remove(organisationId: string, id: string): Promise<void> {
    const po = await this.findOne(organisationId, id);
    if (po.status !== 'draft') {
      throw new BadRequestException(
        'Cannot delete a Purchase Order that is not in draft status',
      );
    }
    await this.poRepository.softDelete(po.id);
  }
}
