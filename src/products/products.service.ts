import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { ManufacturersService } from '../manufacturers/manufacturers.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    private manufacturersService: ManufacturersService,
  ) {}

  async create(
    manufacturerId: string,
    createProductDto: CreateProductDto,
  ): Promise<Product> {
    const manufacturer = await this.manufacturersService.findByUserId(manufacturerId);
    
    const product = this.productsRepository.create({
      ...createProductDto,
      manufacturerId: manufacturer.id,
      gstRate: createProductDto.gstRate || 0,
      minOrderQuantity: createProductDto.minOrderQuantity || 1,
    });

    return this.productsRepository.save(product);
  }

  async findAll(
    manufacturerId?: string,
    filters?: {
      page?: number;
      limit?: number;
      category?: string;
      search?: string;
      isActive?: boolean;
    },
  ): Promise<{ data: Product[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const page = Math.max(1, filters?.page || 1);
    const limit = Math.min(100, Math.max(1, filters?.limit || 20));
    const skip = (page - 1) * limit;

    const queryBuilder = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.manufacturer', 'manufacturer');

    // Apply filters
    if (manufacturerId) {
      queryBuilder.where('product.manufacturerId = :manufacturerId', { manufacturerId });
    }

    if (filters?.isActive !== undefined) {
      queryBuilder.andWhere('product.isActive = :isActive', { isActive: filters.isActive });
    }

    if (filters?.category) {
      queryBuilder.andWhere('product.category = :category', { category: filters.category });
    }

    if (filters?.search) {
      queryBuilder.andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search OR product.description ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    // Order by
    queryBuilder.orderBy('product.createdAt', 'DESC');

    // Execute query
    const products = await queryBuilder.getMany();

    const totalPages = Math.ceil(total / limit);

    return {
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: ['manufacturer'],
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async findBySku(sku: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { sku },
    });

    if (!product) {
      throw new NotFoundException(`Product with SKU ${sku} not found`);
    }

    return product;
  }

  async update(id: string, updateData: Partial<Product>): Promise<Product> {
    await this.productsRepository.update(id, updateData);
    return this.findOne(id);
  }

  async updateStock(id: string, quantity: number): Promise<Product> {
    const product = await this.findOne(id);
    product.stockQuantity = Math.max(0, product.stockQuantity + quantity);
    return this.productsRepository.save(product);
  }

  async remove(id: string): Promise<void> {
    const result = await this.productsRepository.softDelete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
  }
}




