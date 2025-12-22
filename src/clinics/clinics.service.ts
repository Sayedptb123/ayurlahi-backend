import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Clinic, ApprovalStatus } from './entities/clinic.entity';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { RejectClinicDto } from './dto/approve-clinic.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Clinic)
    private clinicsRepository: Repository<Clinic>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(userRole: string) {
    // Only admin and support can see all clinics
    if (!['admin', 'support'].includes(userRole)) {
      throw new ForbiddenException('You do not have permission to view all clinics');
    }

    return this.clinicsRepository.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string, userRole: string) {
    const clinic = await this.clinicsRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!clinic) {
      throw new NotFoundException(`Clinic with ID ${id} not found`);
    }

    // Clinic users can only see their own clinic
    if (userRole === 'clinic') {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user || user.clinicId !== clinic.id) {
        throw new ForbiddenException('You do not have access to this clinic');
      }
    }

    return clinic;
  }

  async findMyClinic(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If user is not a clinic user, return null instead of error
    if (user.role !== 'clinic') {
      return null;
    }

    if (!user.clinicId) {
      // Clinic user but no clinic associated - this is a valid state (pending registration)
      return null;
    }

    const clinic = await this.clinicsRepository.findOne({
      where: { id: user.clinicId, deletedAt: IsNull() },
    });

    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    return clinic;
  }

  async update(id: string, userId: string, userRole: string, updateDto: UpdateClinicDto) {
    const clinic = await this.findOne(id, userId, userRole);

    // Only clinic owner or admin can update
    if (userRole === 'clinic') {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user || user.clinicId !== clinic.id) {
        throw new ForbiddenException('You can only update your own clinic');
      }
    } else if (!['admin', 'support'].includes(userRole)) {
      throw new ForbiddenException('You do not have permission to update clinics');
    }

    Object.assign(clinic, updateDto);
    return this.clinicsRepository.save(clinic);
  }

  async approve(id: string, approvedBy: string) {
    const clinic = await this.clinicsRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!clinic) {
      throw new NotFoundException(`Clinic with ID ${id} not found`);
    }

    clinic.approvalStatus = ApprovalStatus.APPROVED;
    clinic.approvedAt = new Date();
    clinic.approvedBy = approvedBy;
    clinic.isVerified = true;

    return this.clinicsRepository.save(clinic);
  }

  async reject(id: string, rejectDto: RejectClinicDto, rejectedBy: string) {
    const clinic = await this.clinicsRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!clinic) {
      throw new NotFoundException(`Clinic with ID ${id} not found`);
    }

    clinic.approvalStatus = ApprovalStatus.REJECTED;
    clinic.rejectionReason = rejectDto.reason;
    clinic.approvedBy = rejectedBy;

    return this.clinicsRepository.save(clinic);
  }
}

