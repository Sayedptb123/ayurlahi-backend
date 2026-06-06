import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TreatmentProtocol } from './entities/treatment-protocol.entity';
import { CreateTreatmentProtocolDto } from './dto/create-treatment-protocol.dto';

/**
 * Phase 24C.3 — minimal authoring of treatment→medicine BOMs. Forecasting that
 * consumes these (expected vs actual consumption) is deferred.
 */
@Injectable()
export class TreatmentProtocolsService {
  constructor(
    @InjectRepository(TreatmentProtocol)
    private readonly protocolRepository: Repository<TreatmentProtocol>,
  ) {}

  async create(
    organisationId: string,
    dto: CreateTreatmentProtocolDto,
  ): Promise<TreatmentProtocol> {
    const protocol = this.protocolRepository.create({
      organisationId,
      name: dto.name,
      description: dto.description ?? null,
      packageId: dto.packageId ?? null,
      isActive: dto.isActive ?? true,
      items: dto.items.map((i) => ({
        productId: i.productId ?? null,
        itemName: i.itemName,
        quantity: i.quantity,
        unit: i.unit ?? null,
      })) as any,
    });
    return this.protocolRepository.save(protocol);
  }

  findAll(organisationId: string): Promise<TreatmentProtocol[]> {
    return this.protocolRepository.find({
      where: { organisationId },
      relations: ['items'],
      order: { name: 'ASC' },
    });
  }

  async findOne(
    organisationId: string,
    id: string,
  ): Promise<TreatmentProtocol> {
    const protocol = await this.protocolRepository.findOne({
      where: { id, organisationId },
      relations: ['items'],
    });
    if (!protocol) {
      throw new NotFoundException(`Treatment protocol ${id} not found`);
    }
    return protocol;
  }

  async remove(organisationId: string, id: string): Promise<void> {
    await this.findOne(organisationId, id);
    await this.protocolRepository.softDelete(id);
  }
}
