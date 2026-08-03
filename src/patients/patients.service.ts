import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { Branch } from '../branches/entities/branch.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { GetPatientsDto } from './dto/get-patients.dto';
import { BranchVisibilityService } from '../branch-visibility/branch-visibility.service';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private patientsRepository: Repository<Patient>,
    @InjectRepository(Branch)
    private branchesRepository: Repository<Branch>,
    private branchVisibilityService: BranchVisibilityService,
  ) {}

  // Next sequential patient_code ("P00001", "P00002", …) for an organisation.
  // Accepts an optional caller-owned EntityManager so it can participate in an
  // existing transaction (e.g. RetreatService.promoteEnquiry()) instead of
  // reading through a separate, non-transactional connection.
  async generateNextPatientCode(
    organisationId: string,
    manager?: EntityManager,
  ): Promise<string> {
    const repo = manager ? manager.getRepository(Patient) : this.patientsRepository;
    const count = await repo.count({ where: { organisationId } });
    return `P${String(count + 1).padStart(5, '0')}`;
  }

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

    // patientId from DTO maps to patientCode (the system MRN). Manual override if
    // supplied; otherwise server-generates the next sequential code for this org.
    let patientCode = createDto.patientId;
    if (patientCode) {
      const existingPatient = await this.patientsRepository.findOne({
        where: {
          organisationId: clinicId as string,
          patientCode,
        },
      });
      if (existingPatient) {
        throw new ConflictException(
          `Patient ID ${patientCode} already exists in this clinic`,
        );
      }
    } else {
      patientCode = await this.generateNextPatientCode(clinicId as string);
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

    // ADR-004 D9 — validated now even though nothing reads it until Phase 4.
    if (createDto.branchId) {
      const branch = await this.branchesRepository.findOne({
        where: { id: createDto.branchId, organisationId: clinicId as string },
      });
      if (!branch) {
        throw new NotFoundException('Branch not found in this organisation');
      }
    }

    const patient = this.patientsRepository.create({
      organisationId: clinicId as string,
      patientCode,
      fileNumber: createDto.fileNumber || null,
      branchId: createDto.branchId || null,
      createdBy: userId,
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
            `Patient ID ${patientCode} already exists in this clinic`,
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
    const { page = 1, limit = 20, search, bloodGroup, branchId } = query;
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

      // ADR-004 D9/Phase 4 — branch-level visibility, additive on top of the
      // organisation filter above, never a replacement for it.
      const visibleBranchIds = await this.branchVisibilityService.resolveVisibleBranchIds(
        userId,
        organisationId,
        userRole,
      );
      if (visibleBranchIds !== null) {
        if (visibleBranchIds.length > 0) {
          queryBuilder.andWhere(
            '(patient.branchId IS NULL OR patient.branchId IN (:...visibleBranchIds))',
            { visibleBranchIds },
          );
        } else {
          // No active branch assignment at all — only organisation-wide
          // (NULL branch) records are visible. Fail closed, not open.
          queryBuilder.andWhere('patient.branchId IS NULL');
        }
      }

      // Branch switcher (personal view filter) — ANDed on top of the visibility
      // filter above, so it can only narrow further, never broaden it. Strict
      // match, not OR-NULL: "All Locations" is the combined view, so picking a
      // specific branch means only that branch's own records, not org-wide
      // ones too. (The visibility filter above still uses OR-NULL — that's
      // access control, not a view preference, and stays unchanged.)
      if (branchId) {
        queryBuilder.andWhere('patient.branchId = :selectedBranchId', { selectedBranchId: branchId });
      }
    }

    if (search) {
      queryBuilder.andWhere(
        '(patient.firstName ILIKE :search OR patient.lastName ILIKE :search OR patient.patientCode ILIKE :search OR patient.fileNumber ILIKE :search OR patient.phone ILIKE :search OR patient.email ILIKE :search)',
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
    // Query builder, not relations:[...] — createdByUser/updatedByUser must never
    // pull User.passwordHash over the wire (it isn't select:false on the entity).
    const patient = await this.patientsRepository
      .createQueryBuilder('patient')
      .leftJoin('patient.createdByUser', 'createdByUser')
      .addSelect(['createdByUser.id', 'createdByUser.firstName', 'createdByUser.lastName'])
      .leftJoin('patient.updatedByUser', 'updatedByUser')
      .addSelect(['updatedByUser.id', 'updatedByUser.firstName', 'updatedByUser.lastName'])
      .where('patient.id = :id', { id })
      .getOne();

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    if (organisationType !== 'AYURLAHI_TEAM') {
      if (!organisationId || organisationId !== patient.organisationId) {
        throw new ForbiddenException('You do not have access to this patient');
      }

      // ADR-004 D9/Phase 4 — branch-level visibility, additive on top of the
      // organisation check above.
      if (patient.branchId) {
        const visibleBranchIds = await this.branchVisibilityService.resolveVisibleBranchIds(
          userId,
          organisationId,
          userRole,
        );
        if (visibleBranchIds !== null && !visibleBranchIds.includes(patient.branchId)) {
          throw new ForbiddenException('You do not have access to this patient');
        }
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
    if (updateDto.fileNumber !== undefined)
      patient.fileNumber = updateDto.fileNumber;
    if (updateDto.branchId !== undefined && updateDto.branchId !== patient.branchId) {
      const branch = await this.branchesRepository.findOne({
        where: { id: updateDto.branchId, organisationId: patient.organisationId },
      });
      if (!branch) {
        throw new NotFoundException('Branch not found in this organisation');
      }
      patient.branchId = updateDto.branchId;
    }
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

    patient.updatedBy = userId;

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
