import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './dto/create-purchase-order.dto';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly poRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly poItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(InventoryItem)
    private readonly inventoryRepository: Repository<InventoryItem>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    organisationId: string,
    createDto: CreatePurchaseOrderDto,
    userId: string,
  ): Promise<PurchaseOrder> {
    const { items: itemsDto, ...poData } = createDto;

    // Calculate totals
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
      relations: ['supplier', 'items', 'items.item'],
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
    }

    Object.assign(po, updateDto);
    return await this.poRepository.save(po);
  }

  private async receivePurchaseOrder(po: PurchaseOrder): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const item of po.items) {
        if (item.itemId) {
          const inventoryItem = await queryRunner.manager.findOne(
            InventoryItem,
            {
              where: { id: item.itemId },
            },
          );

          if (inventoryItem) {
            inventoryItem.currentStock += item.quantity;
            inventoryItem.costPrice = item.unitPrice; // Update cost price with latest PO price
            await queryRunner.manager.save(inventoryItem);
          }
        }

        // Update item received quantity
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
    await this.poRepository.remove(po);
  }
}
