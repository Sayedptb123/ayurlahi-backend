import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Staff } from './entities/staff.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums/role.enum';
import {
  StaffPosition,
  isValidPositionForOrganization,
} from '../common/enums/staff-position.enum';
import { ClinicsService } from '../clinics/clinics.service';
import { ManufacturersService } from '../manufacturers/manufacturers.service';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    private clinicsService: ClinicsService,
    private manufacturersService: ManufacturersService,
  ) {}

  /**
   * Get organization info from user
   */
  private async getOrganizationInfo(user: User): Promise<{
    organizationId: string;
    organizationType: 'clinic' | 'manufacturer';
  }> {
    if (user.role === UserRole.CLINIC) {
      // Always fetch clinic to ensure we have the ID
      const clinic = await this.clinicsService.findByUserId(user.id);
      return {
        organizationId: clinic.id,
        organizationType: 'clinic',
      };
    } else if (user.role === UserRole.MANUFACTURER) {
      // Always fetch manufacturer to ensure we have the ID
      const manufacturer = await this.manufacturersService.findByUserId(
        user.id,
      );
      return {
        organizationId: manufacturer.id,
        organizationType: 'manufacturer',
      };
    } else {
      throw new ForbiddenException(
        'Only clinic and manufacturer users can manage staff',
      );
    }
  }

  /**
   * Verify staff belongs to user's organization
   */
  private async verifyStaffOwnership(
    staffId: string,
    user: User,
  ): Promise<Staff> {
    const staff = await this.staffRepository.findOne({
      where: { id: staffId },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    const orgInfo = await this.getOrganizationInfo(user);

    if (
      staff.organizationId !== orgInfo.organizationId ||
      staff.organizationType !== orgInfo.organizationType
    ) {
      throw new ForbiddenException(
        'You can only manage staff from your own organization',
      );
    }

    return staff;
  }

  async findAll(
    user: User,
    page?: number,
    limit?: number,
    position?: StaffPosition,
    isActive?: boolean,
  ) {
    const orgInfo = await this.getOrganizationInfo(user);

    const where: FindOptionsWhere<Staff> = {
      organizationId: orgInfo.organizationId,
      organizationType: orgInfo.organizationType,
    };

    if (position !== undefined) {
      where.position = position;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (page && limit) {
      const skip = (page - 1) * limit;
      const [data, total] = await this.staffRepository.findAndCount({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      });

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    const data = await this.staffRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    return {
      data,
      pagination: {
        page: 1,
        limit: data.length,
        total: data.length,
        totalPages: 1,
      },
    };
  }

  async findOne(id: string, user: User): Promise<Staff> {
    return this.verifyStaffOwnership(id, user);
  }

  async create(createStaffDto: CreateStaffDto, user: User): Promise<Staff> {
    const orgInfo = await this.getOrganizationInfo(user);

    // Validate position matches organization type
    if (
      !isValidPositionForOrganization(
        createStaffDto.position,
        orgInfo.organizationType,
      )
    ) {
      throw new BadRequestException(
        `Position "${createStaffDto.position}" is not valid for ${orgInfo.organizationType} organizations`,
      );
    }

    // Validate positionCustom if position is 'other'
    if (
      createStaffDto.position === StaffPosition.OTHER &&
      !createStaffDto.positionCustom
    ) {
      throw new BadRequestException(
        'positionCustom is required when position is "other"',
      );
    }

    // Convert date strings to Date objects
    const dateOfBirth = createStaffDto.dateOfBirth
      ? new Date(createStaffDto.dateOfBirth)
      : null;
    const dateOfJoining = createStaffDto.dateOfJoining
      ? new Date(createStaffDto.dateOfJoining)
      : null;

    const staff = this.staffRepository.create({
      ...createStaffDto,
      organizationId: orgInfo.organizationId,
      organizationType: orgInfo.organizationType,
      dateOfBirth,
      dateOfJoining,
      isActive: true, // Default to active
    });

    return this.staffRepository.save(staff);
  }

  async update(
    id: string,
    updateStaffDto: UpdateStaffDto,
    user: User,
  ): Promise<Staff> {
    const staff = await this.verifyStaffOwnership(id, user);
    const orgInfo = await this.getOrganizationInfo(user);

    // Validate position if being updated
    if (updateStaffDto.position !== undefined) {
      if (
        !isValidPositionForOrganization(
          updateStaffDto.position,
          orgInfo.organizationType,
        )
      ) {
        throw new BadRequestException(
          `Position "${updateStaffDto.position}" is not valid for ${orgInfo.organizationType} organizations`,
        );
      }

      // Validate positionCustom if position is 'other'
      if (
        updateStaffDto.position === StaffPosition.OTHER &&
        !updateStaffDto.positionCustom
      ) {
        throw new BadRequestException(
          'positionCustom is required when position is "other"',
        );
      }
    }

    // Convert date strings to Date objects if provided
    if (updateStaffDto.dateOfBirth !== undefined) {
      staff.dateOfBirth = updateStaffDto.dateOfBirth
        ? new Date(updateStaffDto.dateOfBirth)
        : null;
    }

    if (updateStaffDto.dateOfJoining !== undefined) {
      staff.dateOfJoining = updateStaffDto.dateOfJoining
        ? new Date(updateStaffDto.dateOfJoining)
        : null;
    }

    // Update other fields
    if (updateStaffDto.firstName !== undefined) {
      staff.firstName = updateStaffDto.firstName;
    }
    if (updateStaffDto.lastName !== undefined) {
      staff.lastName = updateStaffDto.lastName;
    }
    if (updateStaffDto.position !== undefined) {
      staff.position = updateStaffDto.position;
    }
    if (updateStaffDto.positionCustom !== undefined) {
      staff.positionCustom = updateStaffDto.positionCustom;
    }
    if (updateStaffDto.email !== undefined) {
      staff.email = updateStaffDto.email;
    }
    if (updateStaffDto.phone !== undefined) {
      staff.phone = updateStaffDto.phone;
    }
    if (updateStaffDto.whatsappNumber !== undefined) {
      staff.whatsappNumber = updateStaffDto.whatsappNumber;
    }
    if (updateStaffDto.address !== undefined) {
      staff.address = updateStaffDto.address;
    }
    if (updateStaffDto.salary !== undefined) {
      staff.salary = updateStaffDto.salary;
    }
    if (updateStaffDto.qualifications !== undefined) {
      staff.qualifications = updateStaffDto.qualifications;
    }
    if (updateStaffDto.specialization !== undefined) {
      staff.specialization = updateStaffDto.specialization;
    }
    if (updateStaffDto.isActive !== undefined) {
      staff.isActive = updateStaffDto.isActive;
    }
    if (updateStaffDto.notes !== undefined) {
      staff.notes = updateStaffDto.notes;
    }

    return this.staffRepository.save(staff);
  }

  async toggleStatus(id: string, user: User): Promise<Staff> {
    const staff = await this.verifyStaffOwnership(id, user);
    staff.isActive = !staff.isActive;
    return this.staffRepository.save(staff);
  }

  async remove(id: string, user: User): Promise<void> {
    const staff = await this.verifyStaffOwnership(id, user);
    await this.staffRepository.softDelete(id);
  }
}

