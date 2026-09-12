import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './dto/create-purchase-order.dto';
import { InventoryItemMaster } from '../inventory/entities/inventory-item-master.entity';
import { InventoryBranchStock } from '../inventory/entities/inventory-branch-stock.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';
import { BranchVisibilityService } from '../branch-visibility/branch-visibility.service';

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
    private readonly dataSource: DataSource,
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
  ): Promise<PurchaseOrder> {
    const po = await this.findOne(organisationId, id);

    // If status is changing to 'received', we need to update inventory
    if (updateDto.status === 'received' && po.status !== 'received') {
      await this.receivePurchaseOrder(po);
      po.receivedAt = new Date(); // Phase 24B.3 — capture receipt time
    }

    Object.assign(po, updateDto);
    return await this.poRepository.save(po);
  }

  // ADR-005 Step 3 -- resolves/creates against the new item-master +
  // branch-stock model (po.branchId, already resolved at create time --
  // never re-resolved here). item.itemId (legacy) is left untouched;
  // item.itemMasterId is what this method actually acts on. The one
  // existing PO (CNS, PO-414905) has both null on its single item, so no
  // existing data flows through either path -- this only affects POs
  // created from here on.
  private async receivePurchaseOrder(po: PurchaseOrder): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const item of po.items) {
        if (item.itemMasterId) {
          const master = await queryRunner.manager.findOne(InventoryItemMaster, {
            where: { id: item.itemMasterId },
          });
          if (master) {
            master.costPrice = item.unitPrice;
            await queryRunner.manager.save(master);

            let stock = await queryRunner.manager.findOne(InventoryBranchStock, {
              where: { itemMasterId: master.id, branchId: po.branchId ?? IsNull() },
            });
            if (!stock) {
              stock = queryRunner.manager.create(InventoryBranchStock, {
                organisationId: po.organisationId,
                branchId: po.branchId,
                itemMasterId: master.id,
                currentStock: 0,
                minStockLevel: 10,
              });
            }
            stock.currentStock += item.quantity;
            await queryRunner.manager.save(stock);

            await queryRunner.manager.save(
              queryRunner.manager.create(StockMovement, {
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
          const inventoryItem = await queryRunner.manager.findOne(InventoryItem, {
            where: { id: item.itemId },
          });
          if (inventoryItem) {
            inventoryItem.currentStock += item.quantity;
            inventoryItem.costPrice = item.unitPrice;
            await queryRunner.manager.save(inventoryItem);
            await queryRunner.manager.save(
              queryRunner.manager.create(StockMovement, {
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
        await queryRunner.manager.save(item);
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
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
