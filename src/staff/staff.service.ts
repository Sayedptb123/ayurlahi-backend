import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff, StaffPosition, OrganizationType } from './entities/staff.entity';
import { User } from '../users/entities/user.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { GetStaffDto } from './dto/get-staff.dto';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  // Clinic positions that clinic users can create
  private readonly clinicPositions = [
    StaffPosition.DOCTOR,
    StaffPosition.THERAPIST,
    StaffPosition.AYURVEDIC_PRACTITIONER,
    StaffPosition.MASSAGE_THERAPIST,
    StaffPosition.YOGA_INSTRUCTOR,
    StaffPosition.DIETITIAN,
    StaffPosition.NUTRITIONIST,
    StaffPosition.PHARMACIST,
    StaffPosition.NURSE,
    StaffPosition.COOK,
    StaffPosition.CHEF,
    StaffPosition.HELPER,
    StaffPosition.ASSISTANT,
    StaffPosition.RECEPTIONIST,
    StaffPosition.MANAGER,
    StaffPosition.ADMINISTRATOR,
    StaffPosition.OTHER,
  ];

  // Manufacturer positions that manufacturer users can create
  private readonly manufacturerPositions = [
    StaffPosition.PRODUCTION_MANAGER,
    StaffPosition.QUALITY_CONTROL,
    StaffPosition.PACKAGER,
    StaffPosition.WAREHOUSE_STAFF,
    StaffPosition.SALES_REPRESENTATIVE,
    StaffPosition.ACCOUNTANT,
    StaffPosition.SUPERVISOR,
    StaffPosition.TECHNICIAN,
    StaffPosition.MANAGER,
    StaffPosition.ADMINISTRATOR,
    StaffPosition.OTHER,
  ];

  async findAll(userId: string, userRole: string, query: GetStaffDto) {
    const { page = 1, limit = 20, position, isActive } = query;
    const skip = (page - 1) * limit;

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Only clinic and manufacturer users can access staff
    if (!['clinic', 'manufacturer', 'admin'].includes(userRole)) {
      throw new ForbiddenException('You do not have permission to view staff');
    }

    // Get organization ID from user
    const organizationId = user.clinicId || user.manufacturerId;
    const organizationType = user.clinicId
      ? OrganizationType.CLINIC
      : OrganizationType.MANUFACTURER;

    // Admin can see all, but for clinic/manufacturer, filter by organization
    const queryBuilder = this.staffRepository.createQueryBuilder('staff');

    if (userRole !== 'admin' && organizationId) {
      queryBuilder.where('staff.organizationId = :organizationId', {
        organizationId,
      });
      queryBuilder.andWhere('staff.organizationType = :organizationType', {
        organizationType,
      });
    }

    if (position) {
      queryBuilder.andWhere('staff.position = :position', { position });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('staff.isActive = :isActive', { isActive });
    }

    const total = await queryBuilder.getCount();
    queryBuilder.skip(skip).take(limit);
    queryBuilder.orderBy('staff.createdAt', 'DESC');

    const data = await queryBuilder.getMany();

    return {
      data: data.map((staff) => this.mapToResponse(staff)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string, userRole: string) {
    const staff = await this.staffRepository.findOne({ where: { id } });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    // Verify user belongs to same organization (unless admin)
    if (userRole !== 'admin') {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const userOrgId = user.clinicId || user.manufacturerId;
      if (staff.organizationId !== userOrgId) {
        throw new ForbiddenException(
          'You do not have access to this staff member',
        );
      }
    }

    return this.mapToResponse(staff);
  }

  async create(userId: string, userRole: string, createDto: CreateStaffDto) {
    // Only clinic and manufacturer users can create staff
    if (!['clinic', 'manufacturer'].includes(userRole)) {
      throw new ForbiddenException(
        'Only clinic and manufacturer users can create staff',
      );
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const organizationId = user.clinicId || user.manufacturerId;
    const organizationType = user.clinicId
      ? OrganizationType.CLINIC
      : OrganizationType.MANUFACTURER;

    if (!organizationId) {
      throw new ForbiddenException('User organization not found');
    }

    // Validate position matches organization type
    const allowedPositions =
      organizationType === OrganizationType.CLINIC
        ? this.clinicPositions
        : this.manufacturerPositions;

    if (!allowedPositions.includes(createDto.position)) {
      throw new BadRequestException(
        'Invalid position for organization type',
      );
    }

    // Validate positionCustom if position is 'other'
    if (
      createDto.position === StaffPosition.OTHER &&
      !createDto.positionCustom
    ) {
      throw new BadRequestException(
        'positionCustom is required when position is "other"',
      );
    }

    const staff = this.staffRepository.create({
      organizationId,
      organizationType,
      firstName: createDto.firstName,
      lastName: createDto.lastName,
      position: createDto.position,
      positionCustom: createDto.positionCustom || null,
      email: createDto.email || null,
      phone: createDto.phone || null,
      whatsappNumber: createDto.whatsappNumber || null,
      addressStreet: createDto.address?.street || null,
      addressCity: createDto.address?.city || null,
      addressDistrict: createDto.address?.district || null,
      addressState: createDto.address?.state || null,
      addressZipCode: createDto.address?.zipCode || null,
      addressCountry: createDto.address?.country || null,
      dateOfBirth: createDto.dateOfBirth
        ? new Date(createDto.dateOfBirth)
        : null,
      dateOfJoining: createDto.dateOfJoining
        ? new Date(createDto.dateOfJoining)
        : null,
      salary: createDto.salary || null,
      qualifications: createDto.qualifications || null,
      specialization: createDto.specialization || null,
      isActive: true,
      notes: createDto.notes || null,
    });

    const savedStaff = await this.staffRepository.save(staff);
    return this.mapToResponse(savedStaff);
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    updateDto: UpdateStaffDto,
  ) {
    const staff = await this.staffRepository.findOne({ where: { id } });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    // Verify user belongs to same organization (unless admin)
    if (userRole !== 'admin') {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const userOrgId = user.clinicId || user.manufacturerId;
      if (staff.organizationId !== userOrgId) {
        throw new ForbiddenException(
          'You do not have access to this staff member',
        );
      }
    }

    // Validate positionCustom if position is being set to 'other'
    if (
      updateDto.position === StaffPosition.OTHER &&
      !updateDto.positionCustom
    ) {
      throw new BadRequestException(
        'positionCustom is required when position is "other"',
      );
    }

    // Update fields
    if (updateDto.firstName !== undefined) staff.firstName = updateDto.firstName;
    if (updateDto.lastName !== undefined) staff.lastName = updateDto.lastName;
    if (updateDto.position !== undefined) staff.position = updateDto.position;
    if (updateDto.positionCustom !== undefined)
      staff.positionCustom = updateDto.positionCustom;
    if (updateDto.email !== undefined) staff.email = updateDto.email;
    if (updateDto.phone !== undefined) staff.phone = updateDto.phone;
    if (updateDto.whatsappNumber !== undefined)
      staff.whatsappNumber = updateDto.whatsappNumber;
    if (updateDto.address !== undefined) {
      staff.addressStreet = updateDto.address?.street || null;
      staff.addressCity = updateDto.address?.city || null;
      staff.addressDistrict = updateDto.address?.district || null;
      staff.addressState = updateDto.address?.state || null;
      staff.addressZipCode = updateDto.address?.zipCode || null;
      staff.addressCountry = updateDto.address?.country || null;
    }
    if (updateDto.dateOfBirth !== undefined)
      staff.dateOfBirth = updateDto.dateOfBirth
        ? new Date(updateDto.dateOfBirth)
        : null;
    if (updateDto.dateOfJoining !== undefined)
      staff.dateOfJoining = updateDto.dateOfJoining
        ? new Date(updateDto.dateOfJoining)
        : null;
    if (updateDto.salary !== undefined) staff.salary = updateDto.salary;
    if (updateDto.qualifications !== undefined)
      staff.qualifications = updateDto.qualifications;
    if (updateDto.specialization !== undefined)
      staff.specialization = updateDto.specialization;
    if (updateDto.isActive !== undefined) staff.isActive = updateDto.isActive;
    if (updateDto.notes !== undefined) staff.notes = updateDto.notes;

    const updatedStaff = await this.staffRepository.save(staff);
    return this.mapToResponse(updatedStaff);
  }

  async remove(id: string, userId: string, userRole: string) {
    const staff = await this.staffRepository.findOne({ where: { id } });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    // Verify user belongs to same organization (unless admin)
    if (userRole !== 'admin') {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const userOrgId = user.clinicId || user.manufacturerId;
      if (staff.organizationId !== userOrgId) {
        throw new ForbiddenException(
          'You do not have access to this staff member',
        );
      }
    }

    await this.staffRepository.remove(staff);
    return { message: 'Staff member deleted successfully' };
  }

  async toggleStatus(id: string, userId: string, userRole: string) {
    const staff = await this.staffRepository.findOne({ where: { id } });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    // Verify user belongs to same organization (unless admin)
    if (userRole !== 'admin') {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const userOrgId = user.clinicId || user.manufacturerId;
      if (staff.organizationId !== userOrgId) {
        throw new ForbiddenException(
          'You do not have access to this staff member',
        );
      }
    }

    staff.isActive = !staff.isActive;
    const updatedStaff = await this.staffRepository.save(staff);
    return this.mapToResponse(updatedStaff);
  }

  private mapToResponse(staff: Staff) {
    return {
      id: staff.id,
      organizationId: staff.organizationId,
      organizationType: staff.organizationType,
      firstName: staff.firstName,
      lastName: staff.lastName,
      position: staff.position,
      positionCustom: staff.positionCustom,
      email: staff.email,
      phone: staff.phone,
      whatsappNumber: staff.whatsappNumber,
      address:
        staff.addressStreet ||
        staff.addressCity ||
        staff.addressDistrict ||
        staff.addressState ||
        staff.addressZipCode ||
        staff.addressCountry
          ? {
              street: staff.addressStreet,
              city: staff.addressCity,
              district: staff.addressDistrict,
              state: staff.addressState,
              zipCode: staff.addressZipCode,
              country: staff.addressCountry,
            }
          : null,
      dateOfBirth: staff.dateOfBirth
        ? staff.dateOfBirth.toISOString().split('T')[0]
        : null,
      dateOfJoining: staff.dateOfJoining
        ? staff.dateOfJoining.toISOString().split('T')[0]
        : null,
      salary: staff.salary ? Number(staff.salary) : null,
      qualifications: staff.qualifications,
      specialization: staff.specialization,
      isActive: staff.isActive,
      notes: staff.notes,
      createdAt: staff.createdAt.toISOString(),
      updatedAt: staff.updatedAt.toISOString(),
    };
  }
}

