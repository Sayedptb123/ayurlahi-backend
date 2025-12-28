import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { User } from '../users/entities/user.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { GetPatientsDto } from './dto/get-patients.dto';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private patientsRepository: Repository<Patient>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    createDto: CreatePatientDto,
  ) {
    // Only clinic users and admin can create patients
    if (
      organisationType !== 'CLINIC' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'SUPPORT'
    ) {
      throw new ForbiddenException(
        'You do not have permission to create patients',
      );
    }

    // Get clinicId from organisationId (in new structure, clinic is an organisation)
    const clinicId = organisationId;
    if (!clinicId && userRole !== 'SUPER_ADMIN' && userRole !== 'SUPPORT') {
      throw new BadRequestException('Clinic not associated with user');
    }

    // Check if patientId is unique within the clinic
    const existingPatient = await this.patientsRepository.findOne({
      where: {
        clinicId: clinicId as string,
        patientId: createDto.patientId,
      },
    });

    if (existingPatient) {
      throw new ConflictException(
        `Patient ID ${createDto.patientId} already exists in this clinic`,
      );
    }

    const patient = this.patientsRepository.create({
      ...createDto,
      clinicId: clinicId as string,
      dateOfBirth: createDto.dateOfBirth
        ? new Date(createDto.dateOfBirth)
        : null,
    });

    return this.patientsRepository.save(patient);
  }

  async findAll(
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    query: GetPatientsDto,
  ) {
    const { page = 1, limit = 20, search, bloodGroup } = query;
    const skip = (page - 1) * limit;

    // Only clinic users and admin can view patients
    if (
      organisationType !== 'CLINIC' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'SUPPORT'
    ) {
      throw new ForbiddenException(
        'You do not have permission to view patients',
      );
    }

    // Build query using query builder for complex search
    const queryBuilder = this.patientsRepository.createQueryBuilder('patient');

    // Clinic users can only see their clinic's patients
    if (organisationType === 'CLINIC') {
      if (!organisationId) {
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }
      queryBuilder.where('patient.clinicId = :clinicId', {
        clinicId: organisationId,
      });
    }

    // Search filter - search across multiple fields
    if (search) {
      queryBuilder.andWhere(
        '(patient.firstName ILIKE :search OR patient.lastName ILIKE :search OR patient.patientId ILIKE :search OR patient.phone ILIKE :search OR patient.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Blood group filter
    if (bloodGroup) {
      queryBuilder.andWhere('patient.bloodGroup = :bloodGroup', {
        bloodGroup,
      });
    }

    // Order and pagination
    queryBuilder.orderBy('patient.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
  ) {
    const patient = await this.patientsRepository.findOne({
      where: { id },
      relations: ['clinic'],
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    // Access control
    if (organisationType === 'CLINIC') {
      if (!organisationId || organisationId !== patient.clinicId) {
        throw new ForbiddenException('You do not have access to this patient');
      }
    }

    return patient;
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    updateDto: UpdatePatientDto,
  ) {
    const patient = await this.findOne(
      id,
      userId,
      userRole,
      organisationId,
      organisationType,
    );

    // Check patientId uniqueness if being updated
    if (updateDto.patientId && updateDto.patientId !== patient.patientId) {
      const existingPatient = await this.patientsRepository.findOne({
        where: {
          clinicId: patient.clinicId,
          patientId: updateDto.patientId,
        },
      });

      if (existingPatient && existingPatient.id !== id) {
        throw new ConflictException(
          `Patient ID ${updateDto.patientId} already exists in this clinic`,
        );
      }
    }

    // Update fields
    if (updateDto.firstName !== undefined)
      patient.firstName = updateDto.firstName;
    if (updateDto.lastName !== undefined) patient.lastName = updateDto.lastName;
    if (updateDto.patientId !== undefined)
      patient.patientId = updateDto.patientId;
    if (updateDto.dateOfBirth !== undefined)
      patient.dateOfBirth = updateDto.dateOfBirth
        ? new Date(updateDto.dateOfBirth)
        : null;
    if (updateDto.gender !== undefined) patient.gender = updateDto.gender;
    if (updateDto.phone !== undefined) patient.phone = updateDto.phone;
    if (updateDto.email !== undefined) patient.email = updateDto.email;
    if (updateDto.address !== undefined) patient.address = updateDto.address;
    if (updateDto.emergencyContact !== undefined)
      patient.emergencyContact = updateDto.emergencyContact;
    if (updateDto.bloodGroup !== undefined)
      patient.bloodGroup = updateDto.bloodGroup;
    if (updateDto.allergies !== undefined)
      patient.allergies = updateDto.allergies;
    if (updateDto.medicalHistory !== undefined)
      patient.medicalHistory = updateDto.medicalHistory;

    return this.patientsRepository.save(patient);
  }

  async remove(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
  ) {
    const patient = await this.findOne(
      id,
      userId,
      userRole,
      organisationId,
      organisationType,
    );
    await this.patientsRepository.remove(patient);
    return { message: 'Patient deleted successfully' };
  }
}
