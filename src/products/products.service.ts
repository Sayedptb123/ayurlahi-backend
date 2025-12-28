import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Product } from './entities/product.entity';
import { GetProductsDto } from './dto/get-products.dto';

import { ManufacturersService } from '../manufacturers/manufacturers.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    private manufacturersService: ManufacturersService,
  ) {}

  async findAll(query: GetProductsDto) {
    const {
      page = 1,
      limit = 20,
      manufacturerId,
      category,
      search,
      isActive,
    } = query;

    const skip = (page - 1) * limit;
    const queryBuilder = this.productsRepository.createQueryBuilder('product');

    // Apply filters
    if (manufacturerId) {
      queryBuilder.andWhere('product.manufacturerId = :manufacturerId', {
        manufacturerId,
      });
    }

    if (category) {
      queryBuilder.andWhere('product.category = :category', { category });
    }

    if (search) {
      queryBuilder.andWhere(
        '(product.name ILIKE :search OR product.description ILIKE :search OR product.sku ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('product.isActive = :isActive', { isActive });
    }

    // Exclude soft-deleted products
    queryBuilder.andWhere('product.deletedAt IS NULL');

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    // Order by creation date (newest first)
    queryBuilder.orderBy('product.createdAt', 'DESC');

    // Execute query
    const data = await queryBuilder.getMany();

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async findBySku(sku: string): Promise<Product | null> {
    return this.productsRepository.findOne({
      where: { sku, deletedAt: IsNull() },
    });
  }

  async create(userId: string, productData: any): Promise<Product> {
    const manufacturer =
      await this.manufacturersService.findMyManufacturer(userId);

    if (!manufacturer) {
      throw new NotFoundException('Manufacturer not found for this user');
    }

    if (manufacturer.approvalStatus !== 'approved') {
      throw new Error('Manufacturer is not approved');
    }

    const product = this.productsRepository.create({
      ...productData,
      manufacturerId: manufacturer.id,
    }) as unknown as Product;

    return await this.productsRepository.save(product);
  }
}
