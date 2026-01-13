import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Product } from './entities/product.entity';
import { GetProductsDto } from './dto/get-products.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductStatus } from './enums/product-status.enum';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) { }

  async findAll(query: GetProductsDto, organisationType?: string) {
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

    // For clinics and undefined: only show ACTIVE products
    // For manufacturers/admin: show all
    if (!organisationType || organisationType === 'CLINIC') {
      queryBuilder.andWhere('product.status = :status', {
        status: ProductStatus.ACTIVE,
      });
    }

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

  async findByManufacturer(manufacturerId: string, query: GetProductsDto) {
    const { page = 1, limit = 20, status, category, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.productsRepository
      .createQueryBuilder('product')
      .where('product.manufacturerId = :manufacturerId', { manufacturerId })
      .andWhere('product.deletedAt IS NULL');

    if (status) {
      queryBuilder.andWhere('product.status = :status', { status });
    }

    if (category) {
      queryBuilder.andWhere('product.category = :category', { category });
    }

    if (search) {
      queryBuilder.andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await queryBuilder.getCount();
    queryBuilder.skip(skip).take(limit);
    queryBuilder.orderBy('product.createdAt', 'DESC');

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

  async create(
    userId: string,
    organisationId: string,
    organisationType: string,
    createProductDto: CreateProductDto,
  ): Promise<Product> {
    // Only manufacturers can create products
    if (organisationType !== 'MANUFACTURER') {
      throw new ForbiddenException('Only manufacturers can create products');
    }

    // Check for duplicate SKU
    const existing = await this.findBySku(createProductDto.sku);
    if (existing) {
      throw new ConflictException('Product with this SKU already exists');
    }

    const product = this.productsRepository.create({
      ...createProductDto,
      manufacturerId: organisationId,
      status: createProductDto.status || ProductStatus.DRAFT,
      isActive: createProductDto.status === ProductStatus.ACTIVE,
    });

    return this.productsRepository.save(product);
  }

  async update(
    id: string,
    userId: string,
    organisationId: string,
    organisationType: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(id);

    // Check ownership
    if (organisationType === 'MANUFACTURER') {
      if (product.manufacturerId !== organisationId) {
        throw new ForbiddenException('You can only update your own products');
      }
    } else if (organisationType && organisationType !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Cannot update archived products
    if (product.status === ProductStatus.ARCHIVED) {
      throw new BadRequestException('Cannot update archived products');
    }

    // If updating SKU, check for duplicates
    if (updateProductDto.sku && updateProductDto.sku !== product.sku) {
      const existing = await this.findBySku(updateProductDto.sku);
      if (existing) {
        throw new ConflictException('Product with this SKU already exists');
      }
    }

    // Create update object with isActive based on status
    const updateData: Partial<Product> = { ...updateProductDto };
    if (updateProductDto.status) {
      updateData.isActive = updateProductDto.status === ProductStatus.ACTIVE;
    }

    Object.assign(product, updateData);
    return this.productsRepository.save(product);
  }

  async archive(
    id: string,
    userId: string,
    organisationId: string,
  ): Promise<Product> {
    const product = await this.findOne(id);

    // Check ownership
    if (product.manufacturerId !== organisationId) {
      throw new ForbiddenException('You can only archive your own products');
    }

    product.status = ProductStatus.ARCHIVED;
    product.isActive = false;
    return this.productsRepository.save(product);
  }

  async hide(
    id: string,
    userId: string,
    organisationId: string,
  ): Promise<Product> {
    const product = await this.findOne(id);

    if (product.manufacturerId !== organisationId) {
      throw new ForbiddenException('You can only hide your own products');
    }

    if (product.status === ProductStatus.ARCHIVED) {
      throw new BadRequestException('Cannot hide archived products');
    }

    product.status = ProductStatus.HIDDEN;
    product.isActive = false;
    return this.productsRepository.save(product);
  }

  async show(
    id: string,
    userId: string,
    organisationId: string,
  ): Promise<Product> {
    const product = await this.findOne(id);

    if (product.manufacturerId !== organisationId) {
      throw new ForbiddenException('You can only show your own products');
    }

    if (product.status === ProductStatus.ARCHIVED) {
      throw new BadRequestException('Cannot show archived products');
    }

    product.status = ProductStatus.ACTIVE;
    product.isActive = true;
    return this.productsRepository.save(product);
  }

  async remove(
    id: string,
    userId: string,
    organisationId: string,
  ): Promise<Product> {
    const product = await this.findOne(id);

    if (product.manufacturerId !== organisationId) {
      throw new ForbiddenException('You can only delete your own products');
    }

    product.deletedAt = new Date();
    product.isActive = false;
    return this.productsRepository.save(product);
  }
}
