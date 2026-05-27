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
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Organisation)
    private organisationsRepository: Repository<Organisation>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(OrganisationUser)
    private organisationUsersRepository: Repository<OrganisationUser>,
    private notificationsService: NotificationsService,
  ) { }

  async findAll(userRole: string, params: { status?: string; page: number; limit: number }) {
    if (!RoleUtils.isAdminOrSupport(userRole)) {
      throw new ForbiddenException('You do not have permission to view all clinics');
    }

    const { status, page, limit } = params;
    const where: any = { type: 'CLINIC', deletedAt: IsNull() };
    if (status) where.approvalStatus = status;

    const [data, total] = await this.organisationsRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
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

    const saved = await this.organisationsRepository.save(clinic);

    this.organisationUsersRepository
      .find({ where: { organisationId: id } })
      .then((members) => {
        const userIds = members.map((m) => m.userId);
        if (userIds.length) {
          this.notificationsService.sendToUsers({
            userIds,
            title: '🎉 Account Approved',
            body: `${clinic.name} has been approved. You can now access all features.`,
            data: { type: 'org_approved' },
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return saved;
  }

  async toggleActive(id: string) {
    const clinic = await this.organisationsRepository.findOne({
      where: { id, type: 'CLINIC', deletedAt: IsNull() },
    });

    if (!clinic) {
      throw new NotFoundException(`Clinic with ID ${id} not found`);
    }

    const newIsActive = !clinic.isActive;
    clinic.isActive = newIsActive;
    const saved = await this.organisationsRepository.save(clinic);

    this.organisationUsersRepository
      .find({ where: { organisationId: id } })
      .then((members) => {
        const userIds = members.map((m) => m.userId);
        if (userIds.length) {
          return this.notificationsService.sendToUsers({
            userIds,
            title: newIsActive ? '✅ Account Reactivated' : '⚠️ Account Deactivated',
            body: newIsActive
              ? `${clinic.name}'s account has been reactivated.`
              : `${clinic.name}'s account has been deactivated. Contact support@ayurlahi.com.`,
            data: { type: newIsActive ? 'org_reactivated' : 'org_deactivated' },
          });
        }
      })
      .catch(() => {});

    return saved;
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

    const saved = await this.organisationsRepository.save(clinic);

    this.organisationUsersRepository
      .find({ where: { organisationId: id } })
      .then((members) => {
        const userIds = members.map((m) => m.userId);
        if (userIds.length) {
          this.notificationsService.sendToUsers({
            userIds,
            title: 'Account Rejected',
            body: rejectDto.reason
              ? `Your application was rejected: ${rejectDto.reason}`
              : `${clinic.name}'s application has been rejected.`,
            data: { type: 'org_rejected' },
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return saved;
  }
}
