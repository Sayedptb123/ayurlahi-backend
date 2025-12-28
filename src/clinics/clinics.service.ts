import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Organisation } from '../organisations/entities/organisation.entity';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { RejectClinicDto } from './dto/approve-clinic.dto';
import { User } from '../users/entities/user.entity';
import { RoleUtils } from '../common/utils/role.utils';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Organisation)
    private organisationsRepository: Repository<Organisation>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(OrganisationUser)
    private organisationUsersRepository: Repository<OrganisationUser>,
  ) { }

  async findAll(userRole: string) {
    // Only admin and support can see all clinics
    if (!RoleUtils.isAdminOrSupport(userRole)) {
      throw new ForbiddenException(
        'You do not have permission to view all clinics',
      );
    }

    // Query organisations table filtered by type='CLINIC'
    return this.organisationsRepository.find({
      where: { type: 'CLINIC', deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string, userRole: string) {
    const clinic = await this.organisationsRepository.findOne({
      where: { id, type: 'CLINIC', deletedAt: IsNull() },
    });

    if (!clinic) {
      throw new NotFoundException(`Clinic with ID ${id} not found`);
    }

    // Clinic users can only see their own clinic
    if (userRole === 'clinic') {
      // Check if user belongs to this organisation
      const orgUser = await this.organisationUsersRepository.findOne({
        where: { userId, organisationId: id },
      });

      if (!orgUser) {
        throw new ForbiddenException('You do not have access to this clinic');
      }
    }

    return clinic;
  }

  async findMyClinic(userId: string) {
    // Find the organisation this user belongs to
    const orgUser = await this.organisationUsersRepository.findOne({
      where: { userId },
      relations: ['organisation'],
    });

    if (!orgUser) {
      return null;
    }

    // Check if it's a clinic organisation
    if (orgUser.organisation.type !== 'CLINIC') {
      return null;
    }

    const clinic = await this.organisationsRepository.findOne({
      where: { id: orgUser.organisationId, deletedAt: IsNull() },
    });

    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    return clinic;
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    updateDto: UpdateClinicDto,
  ) {
    const clinic = await this.findOne(id, userId, userRole);

    // Only clinic owner or admin can update
    if (userRole === 'clinic') {
      // Check if user belongs to this organisation
      const orgUser = await this.organisationUsersRepository.findOne({
        where: { userId, organisationId: id },
      });

      if (!orgUser) {
        throw new ForbiddenException('You can only update your own clinic');
      }
    } else if (!RoleUtils.isAdminOrSupport(userRole)) {
      throw new ForbiddenException(
        'You do not have permission to update clinics',
      );
    }

    Object.assign(clinic, updateDto);
    return this.organisationsRepository.save(clinic);
  }

  async approve(id: string, approvedBy: string) {
    const clinic = await this.organisationsRepository.findOne({
      where: { id, type: 'CLINIC', deletedAt: IsNull() },
    });

    if (!clinic) {
      throw new NotFoundException(`Clinic with ID ${id} not found`);
    }

    clinic.approvalStatus = 'approved';
    clinic.approvedAt = new Date();
    clinic.approvedBy = approvedBy;
    clinic.isVerified = true;

    return this.organisationsRepository.save(clinic);
  }

  async reject(id: string, rejectDto: RejectClinicDto, rejectedBy: string) {
    const clinic = await this.organisationsRepository.findOne({
      where: { id, type: 'CLINIC', deletedAt: IsNull() },
    });

    if (!clinic) {
      throw new NotFoundException(`Clinic with ID ${id} not found`);
    }

    clinic.approvalStatus = 'rejected';
    clinic.rejectionReason = rejectDto.reason;
    clinic.approvedBy = rejectedBy;

    return this.organisationsRepository.save(clinic);
  }
}
