import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from './entities/clinic.entity';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Clinic)
    private clinicsRepository: Repository<Clinic>,
  ) {}

  async create(userId: string, createClinicDto: CreateClinicDto): Promise<Clinic> {
    const clinic = this.clinicsRepository.create({
      ...createClinicDto,
      userId,
    });
    return this.clinicsRepository.save(clinic);
  }

  async findAll(): Promise<Clinic[]> {
    return this.clinicsRepository.find({
      relations: ['user'],
    });
  }

  async findOne(id: string): Promise<Clinic> {
    const clinic = await this.clinicsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!clinic) {
      throw new NotFoundException(`Clinic with ID ${id} not found`);
    }

    return clinic;
  }

  async findByUserId(userId: string): Promise<Clinic> {
    const clinic = await this.clinicsRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!clinic) {
      throw new NotFoundException(`Clinic for user ${userId} not found`);
    }

    return clinic;
  }

  async update(id: string, updateClinicDto: UpdateClinicDto): Promise<Clinic> {
    await this.clinicsRepository.update(id, updateClinicDto);
    return this.findOne(id);
  }

  async approve(id: string, approvedBy: string): Promise<Clinic> {
    const clinic = await this.findOne(id);
    if (clinic.approvalStatus === 'approved') {
      throw new BadRequestException('Clinic is already approved');
    }

    clinic.approvalStatus = 'approved';
    clinic.isVerified = true;
    clinic.approvedAt = new Date();
    clinic.approvedBy = approvedBy;

    return this.clinicsRepository.save(clinic);
  }

  async reject(id: string, reason: string, rejectedBy: string): Promise<Clinic> {
    const clinic = await this.findOne(id);
    clinic.approvalStatus = 'rejected';
    clinic.rejectionReason = reason;
    clinic.approvedBy = rejectedBy;

    return this.clinicsRepository.save(clinic);
  }

  async remove(id: string): Promise<void> {
    const result = await this.clinicsRepository.softDelete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Clinic with ID ${id} not found`);
    }
  }
}





