import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Organisation } from '../organisations/entities/organisation.entity';
import { RejectManufacturerDto } from './dto/reject-manufacturer.dto';
import { User } from '../users/entities/user.entity';
import { RoleUtils } from '../common/utils/role.utils';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ManufacturersService {
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
      throw new ForbiddenException('You do not have permission to view all manufacturers');
    }

    const { status, page, limit } = params;
    const where: any = { type: 'MANUFACTURER', deletedAt: IsNull() };
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
    const manufacturer = await this.organisationsRepository.findOne({
      where: { id, type: 'MANUFACTURER', deletedAt: IsNull() },
    });

    if (!manufacturer) {
      throw new NotFoundException(`Manufacturer with ID ${id} not found`);
    }

    // Manufacturer users can only see their own manufacturer
    if (userRole === 'manufacturer') {
      // Check if user belongs to this organisation
      const orgUser = await this.organisationUsersRepository.findOne({
        where: { userId, organisationId: id },
      });

      if (!orgUser) {
        throw new ForbiddenException(
          'You do not have access to this manufacturer',
        );
      }
    }

    return manufacturer;
  }

  async findMyManufacturer(userId: string) {
    // Find the organisation this user belongs to
    const orgUser = await this.organisationUsersRepository.findOne({
      where: { userId },
      relations: ['organisation'],
    });

    if (!orgUser) {
      return null;
    }

    // Check if it's a manufacturer organisation
    if (orgUser.organisation.type !== 'MANUFACTURER') {
      return null;
    }

    const manufacturer = await this.organisationsRepository.findOne({
      where: { id: orgUser.organisationId, deletedAt: IsNull() },
    });

    if (!manufacturer) {
      throw new NotFoundException('Manufacturer not found');
    }

    return manufacturer;
  }

  async approve(id: string, approvedBy: string) {
    const manufacturer = await this.organisationsRepository.findOne({
      where: { id, type: 'MANUFACTURER', deletedAt: IsNull() },
    });

    if (!manufacturer) {
      throw new NotFoundException(`Manufacturer with ID ${id} not found`);
    }

    manufacturer.approvalStatus = 'approved';
    manufacturer.approvedAt = new Date();
    manufacturer.approvedBy = approvedBy;

    const saved = await this.organisationsRepository.save(manufacturer);

    this.organisationUsersRepository
      .find({ where: { organisationId: id } })
      .then((members) => {
        const userIds = members.map((m) => m.userId);
        if (userIds.length) {
          this.notificationsService.sendToUsers({
            userIds,
            title: '🎉 Account Approved',
            body: `${manufacturer.name} has been approved. You can now access all features.`,
            data: { type: 'org_approved' },
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return saved;
  }

  async toggleActive(id: string) {
    const manufacturer = await this.organisationsRepository.findOne({
      where: { id, type: 'MANUFACTURER', deletedAt: IsNull() },
    });

    if (!manufacturer) {
      throw new NotFoundException(`Manufacturer with ID ${id} not found`);
    }

    const newIsActive = !manufacturer.isActive;
    manufacturer.isActive = newIsActive;
    const saved = await this.organisationsRepository.save(manufacturer);

    this.organisationUsersRepository
      .find({ where: { organisationId: id } })
      .then((members) => {
        const userIds = members.map((m) => m.userId);
        if (userIds.length) {
          return this.notificationsService.sendToUsers({
            userIds,
            title: newIsActive ? '✅ Account Reactivated' : '⚠️ Account Deactivated',
            body: newIsActive
              ? `${manufacturer.name}'s account has been reactivated.`
              : `${manufacturer.name}'s account has been deactivated. Contact support@ayurlahi.com.`,
            data: { type: newIsActive ? 'org_reactivated' : 'org_deactivated' },
          });
        }
      })
      .catch(() => {});

    return saved;
  }

  async reject(
    id: string,
    rejectDto: RejectManufacturerDto,
    rejectedBy: string,
  ) {
    const manufacturer = await this.organisationsRepository.findOne({
      where: { id, type: 'MANUFACTURER', deletedAt: IsNull() },
    });

    if (!manufacturer) {
      throw new NotFoundException(`Manufacturer with ID ${id} not found`);
    }

    manufacturer.approvalStatus = 'rejected';
    manufacturer.rejectionReason = rejectDto.reason;
    manufacturer.approvedBy = rejectedBy;

    const saved = await this.organisationsRepository.save(manufacturer);

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
              : `${manufacturer.name}'s application has been rejected.`,
            data: { type: 'org_rejected' },
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return saved;
  }
}
