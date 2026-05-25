import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vital } from './entities/vital.entity';
import { CreateVitalDto } from './dto/create-vital.dto';

@Injectable()
export class VitalsService {
  constructor(
    @InjectRepository(Vital)
    private vitalsRepository: Repository<Vital>,
  ) {}

  async getVitals(organisationId: string, patientId?: string): Promise<Vital[]> {
    const where: Record<string, string> = { organisationId };
    if (patientId) {
      where.patientId = patientId;
    }
    return this.vitalsRepository.find({
      where,
      order: { recordedAt: 'DESC' },
    });
  }

  async createVital(
    organisationId: string,
    patientId: string,
    dto: CreateVitalDto,
    userId: string,
  ): Promise<Vital> {
    const vital = this.vitalsRepository.create({
      organisationId,
      patientId,
      recordedBy: userId,
      recordedAt: new Date(dto.recordedAt),
      bp: dto.bp ?? null,
      temperature: dto.temperature ?? null,
      pulse: dto.pulse ?? null,
      spo2: dto.spo2 ?? null,
      weight: dto.weight ?? null,
      height: dto.height ?? null,
      painScore: dto.painScore ?? null,
      notes: dto.notes ?? null,
    });
    return this.vitalsRepository.save(vital);
  }

  async deleteVital(organisationId: string, id: string): Promise<{ message: string }> {
    const vital = await this.vitalsRepository.findOne({
      where: { id, organisationId },
    });
    if (!vital) {
      throw new NotFoundException(`Vital record with ID ${id} not found`);
    }
    await this.vitalsRepository.remove(vital);
    return { message: 'Vital record deleted successfully' };
  }
}
