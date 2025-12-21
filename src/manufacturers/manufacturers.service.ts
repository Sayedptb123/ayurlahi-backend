import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Manufacturer } from './entities/manufacturer.entity';
import { CreateManufacturerDto } from './dto/create-manufacturer.dto';

@Injectable()
export class ManufacturersService {
  constructor(
    @InjectRepository(Manufacturer)
    private manufacturersRepository: Repository<Manufacturer>,
  ) {}

  async create(
    userId: string,
    createManufacturerDto: CreateManufacturerDto,
  ): Promise<Manufacturer> {
    const manufacturer = this.manufacturersRepository.create({
      ...createManufacturerDto,
      userId,
      commissionRate: createManufacturerDto.commissionRate || 0,
    });
    return this.manufacturersRepository.save(manufacturer);
  }

  async findAll(): Promise<Manufacturer[]> {
    return this.manufacturersRepository.find({
      relations: ['user'],
    });
  }

  async findOne(id: string): Promise<Manufacturer> {
    const manufacturer = await this.manufacturersRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!manufacturer) {
      throw new NotFoundException(`Manufacturer with ID ${id} not found`);
    }

    return manufacturer;
  }

  async findByUserId(userId: string): Promise<Manufacturer> {
    const manufacturer = await this.manufacturersRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!manufacturer) {
      throw new NotFoundException(`Manufacturer for user ${userId} not found`);
    }

    return manufacturer;
  }

  async approve(id: string, approvedBy: string): Promise<Manufacturer> {
    const manufacturer = await this.findOne(id);
    if (manufacturer.approvalStatus === 'approved') {
      throw new BadRequestException('Manufacturer is already approved');
    }

    manufacturer.approvalStatus = 'approved';
    manufacturer.isVerified = true;
    manufacturer.approvedAt = new Date();
    manufacturer.approvedBy = approvedBy;

    return this.manufacturersRepository.save(manufacturer);
  }

  async reject(id: string, reason: string, rejectedBy: string): Promise<Manufacturer> {
    const manufacturer = await this.findOne(id);
    manufacturer.approvalStatus = 'rejected';
    manufacturer.rejectionReason = reason;
    manufacturer.approvedBy = rejectedBy;

    return this.manufacturersRepository.save(manufacturer);
  }
}





