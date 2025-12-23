import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Doctor } from './entities/doctor.entity';
import { User } from '../users/entities/user.entity';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { GetDoctorsDto } from './dto/get-doctors.dto';

@Injectable()
export class DoctorsService {
  constructor(
    @InjectRepository(Doctor)
    private doctorsRepository: Repository<Doctor>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(userId: string, userRole: string, createDto: CreateDoctorDto) {
    // Only clinic users and admin can create doctors
    if (!['clinic', 'admin'].includes(userRole)) {
      throw new ForbiddenException(
        'You do not have permission to create doctors',
      );
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get clinicId - admin can specify, clinic users use their own
    const clinicId = user.clinicId;
    if (!clinicId && userRole !== 'admin') {
      throw new BadRequestException('Clinic not associated with user');
    }

    // Check if doctorId is unique within the clinic
    const existingDoctor = await this.doctorsRepository.findOne({
      where: {
        clinicId: clinicId as string,
        doctorId: createDto.doctorId,
      },
    });

    if (existingDoctor) {
      throw new ConflictException(
        `Doctor ID ${createDto.doctorId} already exists in this clinic`,
      );
    }

    // If userId is provided, verify it exists and belongs to the clinic
    if (createDto.userId) {
      const linkedUser = await this.usersRepository.findOne({
        where: { id: createDto.userId },
      });
      if (!linkedUser) {
        throw new NotFoundException('Linked user not found');
      }
      if (linkedUser.clinicId !== clinicId) {
        throw new BadRequestException(
          'Linked user does not belong to this clinic',
        );
      }
    }

    const doctor = this.doctorsRepository.create({
      ...createDto,
      clinicId: clinicId as string,
      consultationFee: createDto.consultationFee ?? 0,
      isActive: createDto.isActive ?? true,
    });

    return this.doctorsRepository.save(doctor);
  }

  async findAll(userId: string, userRole: string, query: GetDoctorsDto) {
    const { page = 1, limit = 20, search, specialization, isActive } = query;
    const skip = (page - 1) * limit;

    // Only clinic users and admin can view doctors
    if (!['clinic', 'admin'].includes(userRole)) {
      throw new ForbiddenException(
        'You do not have permission to view doctors',
      );
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Build query using query builder
    const queryBuilder = this.doctorsRepository.createQueryBuilder('doctor');

    // Clinic users can only see their clinic's doctors
    if (userRole === 'clinic') {
      if (!user.clinicId) {
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }
      queryBuilder.where('doctor.clinicId = :clinicId', {
        clinicId: user.clinicId,
      });
    }

    // Search filter
    if (search) {
      queryBuilder.andWhere(
        '(doctor.firstName ILIKE :search OR doctor.lastName ILIKE :search OR doctor.doctorId ILIKE :search OR doctor.specialization ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Specialization filter
    if (specialization) {
      queryBuilder.andWhere('doctor.specialization = :specialization', {
        specialization,
      });
    }

    // Active status filter
    if (isActive !== undefined) {
      queryBuilder.andWhere('doctor.isActive = :isActive', { isActive });
    }

    // Order and pagination
    queryBuilder
      .orderBy('doctor.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, userId: string, userRole: string) {
    const doctor = await this.doctorsRepository.findOne({
      where: { id },
      relations: ['clinic', 'user'],
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${id} not found`);
    }

    // Access control
    if (userRole === 'clinic') {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user || user.clinicId !== doctor.clinicId) {
        throw new ForbiddenException('You do not have access to this doctor');
      }
    }

    return doctor;
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    updateDto: UpdateDoctorDto,
  ) {
    const doctor = await this.findOne(id, userId, userRole);

    // Check doctorId uniqueness if being updated
    if (updateDto.doctorId && updateDto.doctorId !== doctor.doctorId) {
      const existingDoctor = await this.doctorsRepository.findOne({
        where: {
          clinicId: doctor.clinicId,
          doctorId: updateDto.doctorId,
        },
      });

      if (existingDoctor && existingDoctor.id !== id) {
        throw new ConflictException(
          `Doctor ID ${updateDto.doctorId} already exists in this clinic`,
        );
      }
    }

    // If userId is being updated, verify it
    if (updateDto.userId && updateDto.userId !== doctor.userId) {
      const linkedUser = await this.usersRepository.findOne({
        where: { id: updateDto.userId },
      });
      if (!linkedUser) {
        throw new NotFoundException('Linked user not found');
      }
      if (linkedUser.clinicId !== doctor.clinicId) {
        throw new BadRequestException(
          'Linked user does not belong to this clinic',
        );
      }
    }

    // Update fields
    Object.assign(doctor, updateDto);

    return this.doctorsRepository.save(doctor);
  }

  async remove(id: string, userId: string, userRole: string) {
    const doctor = await this.findOne(id, userId, userRole);
    await this.doctorsRepository.remove(doctor);
    return { message: 'Doctor deleted successfully' };
  }
}

