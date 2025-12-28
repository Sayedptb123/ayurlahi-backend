import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
} from './dto/create-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
  ) {}

  async create(
    organisationId: string,
    createSupplierDto: CreateSupplierDto,
  ): Promise<Supplier> {
    const supplier = this.suppliersRepository.create({
      ...createSupplierDto,
      organisationId,
    });
    return await this.suppliersRepository.save(supplier);
  }

  async findAll(organisationId: string): Promise<Supplier[]> {
    return await this.suppliersRepository.find({
      where: { organisationId },
      order: { name: 'ASC' },
    });
  }

  async findOne(organisationId: string, id: string): Promise<Supplier> {
    const supplier = await this.suppliersRepository.findOne({
      where: { id, organisationId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    return supplier;
  }

  async update(
    organisationId: string,
    id: string,
    updateSupplierDto: UpdateSupplierDto,
  ): Promise<Supplier> {
    const supplier = await this.findOne(organisationId, id);

    Object.assign(supplier, updateSupplierDto);
    return await this.suppliersRepository.save(supplier);
  }

  async remove(organisationId: string, id: string): Promise<void> {
    const supplier = await this.findOne(organisationId, id);
    await this.suppliersRepository.remove(supplier);
  }
}
