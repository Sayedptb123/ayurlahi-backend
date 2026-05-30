import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
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
    @InjectRepository(OrganisationUser)
    private readonly orgUserRepository: Repository<OrganisationUser>,
    private readonly notificationsService: NotificationsService,
  ) { }

  async create(
    organisationId: string,
    createInventoryItemDto: CreateInventoryItemDto,
  ): Promise<InventoryItem> {
    const item = this.inventoryRepository.create({
      ...createInventoryItemDto,
      organisationId,
    });
    return await this.inventoryRepository.save(item);
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

    Object.assign(item, updateInventoryItemDto);
    const saved = await this.inventoryRepository.save(item);

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

  async addStock(
    organisationId: string,
    items: Array<{
      sku: string;
      name: string;
      quantity: number;
      unitPrice: number;
      unit?: string;
    }>,
  ): Promise<void> {
    for (const item of items) {
      // Find existing item by SKU
      let inventoryItem = await this.inventoryRepository.findOne({
        where: { organisationId, sku: item.sku },
      });

      if (inventoryItem) {
        // Update stock
        inventoryItem.currentStock += item.quantity;
        // Optionally update price (weighted average or latest?) - Keeping simple: latest
        inventoryItem.unitPrice = item.unitPrice;
        await this.inventoryRepository.save(inventoryItem);
      } else {
        // Create new item
        inventoryItem = this.inventoryRepository.create({
          organisationId,
          name: item.name,
          sku: item.sku,
          currentStock: item.quantity,
          unitPrice: item.unitPrice,
          unit: item.unit || 'Unit', // Default unit
          minStockLevel: 10, // Default min stock
          costPrice: item.unitPrice, // Assumed cost matches purchase price
        });
        await this.inventoryRepository.save(inventoryItem);
      }
    }
  }
}
