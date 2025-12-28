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

@Injectable()
export class ManufacturersService {
  constructor(
    @InjectRepository(Organisation)
    private organisationsRepository: Repository<Organisation>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(OrganisationUser)
    private organisationUsersRepository: Repository<OrganisationUser>,
  ) { }

  async findAll(userRole: string) {
    // Only admin and support can see all manufacturers
    if (!RoleUtils.isAdminOrSupport(userRole)) {
      throw new ForbiddenException(
        'You do not have permission to view all manufacturers',
      );
    }

    // Query organisations table filtered by type='MANUFACTURER'
    return this.organisationsRepository.find({
      where: { type: 'MANUFACTURER', deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
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
    manufacturer.isVerified = true;

    return this.organisationsRepository.save(manufacturer);
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

    return this.organisationsRepository.save(manufacturer);
  }
}
