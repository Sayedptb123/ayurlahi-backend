import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { Organisation } from './entities/organisation.entity';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { GetOrganisationsDto } from './dto/get-organisations.dto';

import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { ClinicCapabilities } from '../clinic-capabilities/entities/clinic-capabilities.entity';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrganisationsService {
  constructor(
    @InjectRepository(Organisation)
    private readonly organisationsRepository: Repository<Organisation>,
    @InjectRepository(OrganisationUser)
    private readonly organisationUserRepository: Repository<OrganisationUser>,
    @InjectRepository(ClinicCapabilities)
    private readonly capabilitiesRepository: Repository<ClinicCapabilities>,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) { }

  private async getTeamUserIds(): Promise<string[]> {
    const teamOrg = await this.organisationsRepository.findOne({
      where: { type: 'AYURLAHI_TEAM' as any },
    });
    if (!teamOrg) return [];
    const members = await this.organisationUserRepository.find({
      where: { organisationId: teamOrg.id, isActive: true },
    });
    return members.map((m) => m.userId).filter(Boolean) as string[];
  }

  private async getOrgOwnerIds(orgId: string): Promise<string[]> {
    const owners = await this.organisationUserRepository.find({
      where: { organisationId: orgId, role: 'OWNER' as any, isActive: true },
    });
    return owners.map((o) => o.userId).filter(Boolean) as string[];
  }

  async create(
    createDto: CreateOrganisationDto,
    createdBy?: string,
    callerOrgType?: string,
  ): Promise<Organisation> {
    const approvalStatus = callerOrgType === 'AYURLAHI_TEAM' ? 'approved' : 'pending';
    const organisation = this.organisationsRepository.create({
      name: createDto.name,
      type: createDto.type,
      approvalStatus,
      isActive: true,
    });

    const savedOrg = await this.organisationsRepository.save(organisation);

    // Notify team when a new org self-registers and is pending approval
    if (approvalStatus === 'pending') {
      this.getTeamUserIds().then((teamUserIds) => {
        if (teamUserIds.length > 0) {
          this.notificationsService.sendToUsers({
            userIds: teamUserIds,
            title: 'New Registration',
            body: `${savedOrg.name} has registered and is waiting for approval`,
            data: { orgId: savedOrg.id, type: 'org_pending' },
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    // Create primary user if provided
    if (createDto.primaryUser) {
      try {
        // Create the user
        // Note: passing 'SUPER_ADMIN' as role to bypass permission check
        const userRole = createDto.type === 'CLINIC' ? 'clinic' : 'manufacturer'; // Mapping to UserRole enum string

        const user = await this.usersService.create('SUPER_ADMIN', {
          email: createDto.primaryUser.email,
          password: createDto.primaryUser.password,
          firstName: createDto.primaryUser.firstName,
          lastName: createDto.primaryUser.lastName,
          phone: createDto.primaryUser.phone,
          isActive: true,
          role: userRole as any,
        });

        // The create method usually returns the user object without password
        // But if it's returning User | User[], we need to be careful.
        // UsersService.create returns Promise<Partial<User>>

        const userId = (user as any).id; // Safe cast since we know it's a user

        // Link user to organisation
        const orgUser = this.organisationUserRepository.create({
          organisationId: savedOrg.id,
          userId: userId,
          role: 'OWNER',
          isPrimary: true,
          createdBy: createdBy,
        });

        await this.organisationUserRepository.save(orgUser);
      } catch (error) {
        console.error('Failed to create primary user for organisation:', error);
        throw error;
      }
    }

    return savedOrg;
  }

  async findAll(query: GetOrganisationsDto): Promise<{
    data: Organisation[];
    total: number;
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      type,
      status,
      approvalStatus,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.organisationsRepository
      .createQueryBuilder('org')
      .leftJoinAndSelect('org.users', 'orgUser', 'orgUser.isPrimary = :isPrimary', { isPrimary: true })
      .leftJoinAndSelect('orgUser.user', 'user')
      .where('org.deletedAt IS NULL');

    if (search) {
      queryBuilder.andWhere(
        '(org.name ILIKE :search OR org.clinicName ILIKE :search OR org.companyName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (type) {
      queryBuilder.andWhere('org.type = :type', { type });
    }

    if (status) {
      queryBuilder.andWhere('org.status = :status', { status });
    }

    if (approvalStatus) {
      queryBuilder.andWhere('org.approvalStatus = :approvalStatus', {
        approvalStatus,
      });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('org.createdAt', 'DESC')
      .getManyAndCount();

    // Attach clinic capabilities for CLINIC type orgs
    if (data.length > 0) {
      const clinicIds = data.filter((o) => o.type === 'CLINIC').map((o) => o.id);
      if (clinicIds.length > 0) {
        const caps = await this.capabilitiesRepository.find({
          where: clinicIds.map((id) => ({ organisationId: id })),
        });
        const capMap = new Map(caps.map((c) => [c.organisationId, c]));
        for (const org of data) {
          if (org.type === 'CLINIC') {
            const cap = capMap.get(org.id);
            (org as any).capabilities = cap
              ? {
                  hasPostnatalCare: cap.hasPostnatalCare,
                  hasAyurveda: cap.hasAyurveda,
                  hasIpd: cap.hasIpd,
                  hasOpd: cap.hasOpd,
                }
              : null;
          }
        }
      }
    }

    return { data, total };
  }

  async findOne(id: string): Promise<Organisation> {
    const organisation = await this.organisationsRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['users', 'users.user'],
    });

    if (!organisation) {
      throw new NotFoundException(`Organisation with ID ${id} not found`);
    }

    // Filter out soft-deleted org_user records before returning
    if (organisation.users) {
      organisation.users = organisation.users.filter((u) => !u.deletedAt);
    }

    return organisation;
  }

  async update(
    id: string,
    updateDto: UpdateOrganisationDto,
  ): Promise<Organisation> {
    const organisation = await this.findOne(id);

    // Update primary user if provided
    if (updateDto.primaryUser && organisation.users) {
      const primaryOrgUser = organisation.users.find(u => u.isPrimary);
      if (primaryOrgUser && primaryOrgUser.user) {
        // Create a partial update object for the user
        const userUpdate: any = {};
        if (updateDto.primaryUser.firstName) userUpdate.firstName = updateDto.primaryUser.firstName;
        if (updateDto.primaryUser.lastName) userUpdate.lastName = updateDto.primaryUser.lastName;
        if (updateDto.primaryUser.phone) userUpdate.phone = updateDto.primaryUser.phone;
        // Email update might be sensitive or require unique check, UsersService.update handles it?
        // UsersService.update usually expects role checks or we pass 'SUPER_ADMIN' to bypass if allowed.
        // Let's assume we can update basic details.

        if (Object.keys(userUpdate).length > 0) {
          await this.usersService.update(primaryOrgUser.user.id, userUpdate, 'SUPER_ADMIN' as any);
        }
      }
    }

    Object.assign(organisation, updateDto);
    // Remove primaryUser from organisation object before saving to avoid error if it tries to map to column
    delete (organisation as any).primaryUser;

    return await this.organisationsRepository.save(organisation);
  }

  async remove(id: string): Promise<void> {
    const organisation = await this.findOne(id);
    await this.organisationsRepository.softDelete(organisation.id);
  }

  async approve(id: string, approvedBy: string): Promise<Organisation> {
    const organisation = await this.findOne(id);

    if (organisation.approvalStatus === 'approved') {
      throw new BadRequestException('Organisation is already approved');
    }

    organisation.approvalStatus = 'approved';
    organisation.approvedAt = new Date();
    organisation.approvedBy = approvedBy;

    const saved = await this.organisationsRepository.save(organisation);

    this.getOrgOwnerIds(saved.id).then((ownerIds) => {
      console.log('[approve] ownerIds resolved:', ownerIds);
      if (ownerIds.length > 0) {
        this.notificationsService.sendToUsers({
          userIds: ownerIds,
          title: 'Application Approved 🎉',
          body: `Your organisation ${saved.name} has been approved. You can now access all features.`,
          data: { orgId: saved.id, type: 'org_approved' },
        }).catch((err) => console.error('[approve] sendToUsers error:', err));
      }
    }).catch((err) => console.error('[approve] getOrgOwnerIds error:', err));

    return saved;
  }

  async reject(
    id: string,
    rejectionReason: string,
    rejectedBy: string,
  ): Promise<Organisation> {
    const organisation = await this.findOne(id);

    if (organisation.approvalStatus === 'approved') {
      throw new BadRequestException('Cannot reject an approved organisation');
    }

    organisation.approvalStatus = 'rejected';
    organisation.rejectionReason = rejectionReason;
    organisation.approvedBy = rejectedBy;

    const saved = await this.organisationsRepository.save(organisation);

    this.getOrgOwnerIds(saved.id).then((ownerIds) => {
      if (ownerIds.length > 0) {
        this.notificationsService.sendToUsers({
          userIds: ownerIds,
          title: 'Application Update',
          body: `Your application for ${saved.name} was not approved. Reason: ${rejectionReason}`,
          data: { orgId: saved.id, type: 'org_rejected' },
        }).catch(() => {});
      }
    }).catch(() => {});

    return saved;
  }

  async getCapabilities(orgId: string) {
    const cap = await this.capabilitiesRepository.findOne({
      where: { organisationId: orgId },
    });
    if (!cap) throw new NotFoundException('Capabilities not found for this organisation');
    return {
      hasPostnatalCare: cap.hasPostnatalCare,
      hasAyurveda: cap.hasAyurveda,
      hasIpd: cap.hasIpd,
      hasOpd: cap.hasOpd,
    };
  }

  async updateCapabilities(
    orgId: string,
    dto: { hasPostnatalCare?: boolean; hasAyurveda?: boolean; hasIpd?: boolean; hasOpd?: boolean; enabledModules?: string[] },
  ) {
    let cap = await this.capabilitiesRepository.findOne({ where: { organisationId: orgId } });
    if (!cap) {
      cap = this.capabilitiesRepository.create({ organisationId: orgId });
    }
    if (dto.hasPostnatalCare !== undefined) cap.hasPostnatalCare = dto.hasPostnatalCare;
    if (dto.hasAyurveda !== undefined) cap.hasAyurveda = dto.hasAyurveda;
    if (dto.hasIpd !== undefined) cap.hasIpd = dto.hasIpd;
    if (dto.hasOpd !== undefined) cap.hasOpd = dto.hasOpd;
    if (dto.enabledModules !== undefined) cap.enabledModules = dto.enabledModules;
    await this.capabilitiesRepository.save(cap);
    return {
      hasPostnatalCare: cap.hasPostnatalCare,
      hasAyurveda: cap.hasAyurveda,
      hasIpd: cap.hasIpd,
      hasOpd: cap.hasOpd,
      enabledModules: cap.enabledModules,
    };
  }
}
