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
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { GetPatientsDto } from './dto/get-patients.dto';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private patientsRepository: Repository<Patient>,
  ) {}

  async create(
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    createDto: CreatePatientDto,
  ) {
    if (
      organisationType !== 'CLINIC' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'SUPPORT'
    ) {
      throw new ForbiddenException(
        'You do not have permission to create patients',
      );
    }

    const clinicId = organisationId;
    if (!clinicId && userRole !== 'SUPER_ADMIN' && userRole !== 'SUPPORT') {
      throw new BadRequestException('Clinic not associated with user');
    }

    // patientId from DTO maps to patientCode in DB
    const existingPatient = await this.patientsRepository.findOne({
      where: {
        organisationId: clinicId as string,
        patientCode: createDto.patientId,
      },
    });

    if (existingPatient) {
      throw new ConflictException(
        `Patient ID ${createDto.patientId} already exists in this clinic`,
      );
    }

    // Duplicate phone check — phone must be unique per organisation
    if (createDto.phone) {
      const phoneConflict = await this.patientsRepository.findOne({
        where: { organisationId: clinicId as string, phone: createDto.phone },
      });
      if (phoneConflict) {
        throw new ConflictException(
          `A patient with phone number ${createDto.phone} is already registered (${phoneConflict.firstName} ${phoneConflict.lastName}). Search for them before registering a new record.`,
        );
      }
    }

    // If motherPatientId is supplied, verify it belongs to the same org (no cross-org linking)
    if (createDto.motherPatientId) {
      const mother = await this.patientsRepository.findOne({
        where: { id: createDto.motherPatientId, organisationId: clinicId as string },
      });
      if (!mother) {
        throw new NotFoundException('Mother patient not found in this clinic');
      }
    }

    const patient = this.patientsRepository.create({
      organisationId: clinicId as string,
      patientCode: createDto.patientId,
      firstName: createDto.firstName,
      lastName: createDto.lastName,
      dateOfBirth: createDto.dateOfBirth ? new Date(createDto.dateOfBirth) : null,
      gender: createDto.gender,
      phone: createDto.phone,
      email: createDto.email,
      address: createDto.address,
      emergencyContact: createDto.emergencyContact,
      bloodGroup: createDto.bloodGroup,
      allergies: createDto.allergies,
      medicalHistory: createDto.medicalHistory,
      motherPatientId: createDto.motherPatientId,
    });

    try {
      return await this.patientsRepository.save(patient);
    } catch (err: any) {
      if (err?.code === '23505') {
        if (err?.constraint?.includes('phone')) {
          throw new ConflictException(
            `A patient with this phone number is already registered in your clinic. Search for them before registering a new record.`,
          );
        }
        if (err?.constraint?.includes('patient_code') || err?.constraint?.includes('patientcode')) {
          throw new ConflictException(
            `Patient ID ${createDto.patientId} already exists in this clinic`,
          );
        }
      }
      throw err;
    }
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

    if (
      organisationType !== 'CLINIC' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'SUPPORT'
    ) {
      throw new ForbiddenException(
        'You do not have permission to view patients',
      );
    }

    const queryBuilder = this.patientsRepository.createQueryBuilder('patient');

    if (organisationType === 'CLINIC') {
      if (!organisationId) {
        return { data: [], total: 0, page, limit, totalPages: 0 };
      }
      queryBuilder.where('patient.organisationId = :organisationId', {
        organisationId,
      });
    }

    if (search) {
      queryBuilder.andWhere(
        '(patient.firstName ILIKE :search OR patient.lastName ILIKE :search OR patient.patientCode ILIKE :search OR patient.phone ILIKE :search OR patient.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (bloodGroup) {
      queryBuilder.andWhere('patient.bloodGroup = :bloodGroup', { bloodGroup });
    }

    queryBuilder.orderBy('patient.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

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

  async findOne(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
  ) {
    const patient = await this.patientsRepository.findOne({
      where: { id },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    if (organisationType !== 'AYURLAHI_TEAM') {
      if (!organisationId || organisationId !== patient.organisationId) {
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
    const patient = await this.patientsRepository.findOne({ where: { id } });
    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }
    if (organisationType === 'CLINIC') {
      if (!organisationId || organisationId !== patient.organisationId) {
        throw new ForbiddenException('You do not have access to this patient');
      }
    }

    // Check patientCode uniqueness if patientId (code) is being updated
    if (updateDto.patientId && updateDto.patientId !== patient.patientCode) {
      const existingPatient = await this.patientsRepository.findOne({
        where: {
          organisationId: patient.organisationId,
          patientCode: updateDto.patientId,
        },
      });

      if (existingPatient && existingPatient.id !== id) {
        throw new ConflictException(
          `Patient ID ${updateDto.patientId} already exists in this clinic`,
        );
      }
    }

    if (updateDto.firstName !== undefined)
      patient.firstName = updateDto.firstName;
    if (updateDto.lastName !== undefined) patient.lastName = updateDto.lastName;
    if (updateDto.patientId !== undefined)
      patient.patientCode = updateDto.patientId;
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
    await this.patientsRepository.softDelete(patient.id);
    return { message: 'Patient deleted successfully' };
  }
}
