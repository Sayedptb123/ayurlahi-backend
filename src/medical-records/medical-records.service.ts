import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalRecord } from './entities/medical-record.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Staff } from '../staff/entities/staff.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { GetMedicalRecordsDto } from './dto/get-medical-records.dto';

@Injectable()
export class MedicalRecordsService {
  constructor(
    @InjectRepository(MedicalRecord)
    private medicalRecordsRepository: Repository<MedicalRecord>,
    @InjectRepository(Patient)
    private patientsRepository: Repository<Patient>,
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @InjectRepository(Appointment)
    private appointmentsRepository: Repository<Appointment>,
  ) {}

  async create(
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    createDto: CreateMedicalRecordDto,
  ) {
    if (
      organisationType !== 'CLINIC' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'SUPPORT'
    ) {
      throw new ForbiddenException(
        'You do not have permission to create medical records',
      );
    }

    const clinicId = organisationId;
    if (!clinicId && userRole !== 'SUPER_ADMIN' && userRole !== 'SUPPORT') {
      throw new BadRequestException('Clinic not associated with user');
    }

    const patient = await this.patientsRepository.findOne({
      where: { id: createDto.patientId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    if (patient.organisationId !== clinicId) {
      throw new ForbiddenException('Patient does not belong to this clinic');
    }

    const doctor = await this.staffRepository.findOne({
      where: { id: createDto.doctorId },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }
    if (doctor.organisationId !== clinicId) {
      throw new ForbiddenException('Doctor does not belong to this clinic');
    }

    if (createDto.appointmentId) {
      const appointment = await this.appointmentsRepository.findOne({
        where: { id: createDto.appointmentId },
      });
      if (!appointment) {
        throw new NotFoundException('Appointment not found');
      }
      if (appointment.organisationId !== clinicId) {
        throw new ForbiddenException(
          'Appointment does not belong to this clinic',
        );
      }
      if (appointment.patientId !== createDto.patientId) {
        throw new BadRequestException(
          'Appointment does not belong to this patient',
        );
      }
    }

    const medicalRecord = this.medicalRecordsRepository.create({
      ...createDto,
      organisationId: clinicId,
      visitDate: new Date(createDto.visitDate),
    });

    return this.medicalRecordsRepository.save(medicalRecord);
  }

  async findAll(
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    query: GetMedicalRecordsDto,
  ) {
    const {
      page = 1,
      limit = 20,
      patientId,
      doctorId,
      appointmentId,
      startDate,
      endDate,
    } = query;
    const skip = (page - 1) * limit;

    if (
      organisationType !== 'CLINIC' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'SUPPORT'
    ) {
      throw new ForbiddenException(
        'You do not have permission to view medical records',
      );
    }

    const queryBuilder = this.medicalRecordsRepository
      .createQueryBuilder('medicalRecord')
      .leftJoinAndSelect('medicalRecord.patient', 'patient')
      .leftJoinAndSelect('medicalRecord.doctor', 'doctor')
      .leftJoinAndSelect('medicalRecord.appointment', 'appointment');

    if (organisationType === 'CLINIC') {
      if (!organisationId) {
        return { data: [], total: 0, page, limit, totalPages: 0 };
      }
      queryBuilder.where('medicalRecord.organisationId = :organisationId', {
        organisationId,
      });
    }

    queryBuilder.andWhere('medicalRecord.deletedAt IS NULL');

    if (patientId) {
      queryBuilder.andWhere('medicalRecord.patientId = :patientId', {
        patientId,
      });
    }

    if (doctorId) {
      queryBuilder.andWhere('medicalRecord.doctorId = :doctorId', { doctorId });
    }

    if (appointmentId) {
      queryBuilder.andWhere('medicalRecord.appointmentId = :appointmentId', {
        appointmentId,
      });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere(
        'medicalRecord.visitDate BETWEEN :startDate AND :endDate',
        { startDate, endDate },
      );
    } else if (startDate) {
      queryBuilder.andWhere('medicalRecord.visitDate >= :startDate', {
        startDate,
      });
    } else if (endDate) {
      queryBuilder.andWhere('medicalRecord.visitDate <= :endDate', { endDate });
    }

    queryBuilder
      .orderBy('medicalRecord.visitDate', 'DESC')
      .addOrderBy('medicalRecord.createdAt', 'DESC')
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

  async findOne(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
  ) {
    const medicalRecord = await this.medicalRecordsRepository.findOne({
      where: { id },
      relations: ['patient', 'doctor', 'appointment'],
    });

    if (!medicalRecord) {
      throw new NotFoundException(`Medical record with ID ${id} not found`);
    }

    if (organisationType === 'CLINIC') {
      if (!organisationId || organisationId !== medicalRecord.organisationId) {
        throw new ForbiddenException(
          'You do not have access to this medical record',
        );
      }
    }

    return medicalRecord;
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    updateDto: UpdateMedicalRecordDto,
  ) {
    const medicalRecord = await this.medicalRecordsRepository.findOne({
      where: { id },
    });

    if (!medicalRecord) {
      throw new NotFoundException(`Medical record with ID ${id} not found`);
    }

    if (organisationType === 'CLINIC') {
      if (
        !organisationId ||
        organisationId !== medicalRecord.organisationId
      ) {
        throw new ForbiddenException(
          'You do not have access to this medical record',
        );
      }
    }

    if (
      updateDto.patientId &&
      updateDto.patientId !== medicalRecord.patientId
    ) {
      const patient = await this.patientsRepository.findOne({
        where: { id: updateDto.patientId },
      });
      if (!patient || patient.organisationId !== medicalRecord.organisationId) {
        throw new ForbiddenException('Patient does not belong to this clinic');
      }
    }

    if (updateDto.doctorId && updateDto.doctorId !== medicalRecord.doctorId) {
      const doctor = await this.staffRepository.findOne({
        where: { id: updateDto.doctorId },
      });
      if (
        !doctor ||
        doctor.organisationId !== medicalRecord.organisationId
      ) {
        throw new ForbiddenException('Doctor does not belong to this clinic');
      }
    }

    if (
      updateDto.appointmentId &&
      updateDto.appointmentId !== medicalRecord.appointmentId
    ) {
      const appointment = await this.appointmentsRepository.findOne({
        where: { id: updateDto.appointmentId },
      });
      if (
        !appointment ||
        appointment.organisationId !== medicalRecord.organisationId
      ) {
        throw new ForbiddenException(
          'Appointment does not belong to this clinic',
        );
      }
    }

    if (updateDto.patientId !== undefined)
      medicalRecord.patientId = updateDto.patientId;
    if (updateDto.appointmentId !== undefined)
      medicalRecord.appointmentId = updateDto.appointmentId;
    if (updateDto.doctorId !== undefined)
      medicalRecord.doctorId = updateDto.doctorId;
    if (updateDto.visitDate !== undefined)
      medicalRecord.visitDate = new Date(updateDto.visitDate);
    if (updateDto.chiefComplaint !== undefined)
      medicalRecord.chiefComplaint = updateDto.chiefComplaint;
    if (updateDto.diagnosis !== undefined)
      medicalRecord.diagnosis = updateDto.diagnosis;
    if (updateDto.treatment !== undefined)
      medicalRecord.treatment = updateDto.treatment;
    if (updateDto.vitals !== undefined) medicalRecord.vitals = updateDto.vitals;
    if (updateDto.notes !== undefined) medicalRecord.notes = updateDto.notes;
    if (updateDto.attachments !== undefined)
      medicalRecord.attachments = updateDto.attachments;

    return this.medicalRecordsRepository.save(medicalRecord);
  }

  async remove(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
  ) {
    const medicalRecord = await this.findOne(
      id,
      userId,
      userRole,
      organisationId,
      organisationType,
    );
    await this.medicalRecordsRepository.softDelete(medicalRecord.id);
    return { message: 'Medical record deleted successfully' };
  }
}
