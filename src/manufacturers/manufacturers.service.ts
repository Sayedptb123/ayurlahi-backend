import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Manufacturer, ApprovalStatus } from './entities/manufacturer.entity';
import { RejectManufacturerDto } from './dto/reject-manufacturer.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ManufacturersService {
  constructor(
    @InjectRepository(Manufacturer)
    private manufacturersRepository: Repository<Manufacturer>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(userRole: string) {
    // Only admin and support can see all manufacturers
    if (!['admin', 'support'].includes(userRole)) {
      throw new ForbiddenException('You do not have permission to view all manufacturers');
    }

    return this.manufacturersRepository.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string, userRole: string) {
    const manufacturer = await this.manufacturersRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!manufacturer) {
      throw new NotFoundException(`Manufacturer with ID ${id} not found`);
    }

    // Manufacturer users can only see their own manufacturer
    if (userRole === 'manufacturer') {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user || user.manufacturerId !== manufacturer.id) {
        throw new ForbiddenException('You do not have access to this manufacturer');
      }
    }

    return manufacturer;
  }

  async findMyManufacturer(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If user is not a manufacturer user, return null instead of error
    if (user.role !== 'manufacturer') {
      return null;
    }

    if (!user.manufacturerId) {
      // Manufacturer user but no manufacturer associated - this is a valid state (pending registration)
      return null;
    }

    const manufacturer = await this.manufacturersRepository.findOne({
      where: { id: user.manufacturerId, deletedAt: IsNull() },
    });

    if (!manufacturer) {
      throw new NotFoundException('Manufacturer not found');
    }

    return manufacturer;
  }

  async approve(id: string, approvedBy: string) {
    const manufacturer = await this.manufacturersRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!manufacturer) {
      throw new NotFoundException(`Manufacturer with ID ${id} not found`);
    }

    manufacturer.approvalStatus = ApprovalStatus.APPROVED;
    manufacturer.approvedAt = new Date();
    manufacturer.approvedBy = approvedBy;
    manufacturer.isVerified = true;

    return this.manufacturersRepository.save(manufacturer);
  }

  async reject(id: string, rejectDto: RejectManufacturerDto, rejectedBy: string) {
    const manufacturer = await this.manufacturersRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!manufacturer) {
      throw new NotFoundException(`Manufacturer with ID ${id} not found`);
    }

    manufacturer.approvalStatus = ApprovalStatus.REJECTED;
    manufacturer.rejectionReason = rejectDto.reason;
    manufacturer.approvedBy = rejectedBy;

    return this.manufacturersRepository.save(manufacturer);
  }
}
