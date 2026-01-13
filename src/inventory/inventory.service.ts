import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
} from './dto/create-inventory-item.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventoryRepository: Repository<InventoryItem>,
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
    return await this.inventoryRepository.save(item);
  }

  async remove(organisationId: string, id: string): Promise<void> {
    const item = await this.findOne(organisationId, id);
    await this.inventoryRepository.remove(item);
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
