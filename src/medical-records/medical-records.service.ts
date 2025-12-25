import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { MedicalRecord } from './entities/medical-record.entity';
import { User } from '../users/entities/user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { GetMedicalRecordsDto } from './dto/get-medical-records.dto';

@Injectable()
export class MedicalRecordsService {
  constructor(
    @InjectRepository(MedicalRecord)
    private medicalRecordsRepository: Repository<MedicalRecord>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Patient)
    private patientsRepository: Repository<Patient>,
    @InjectRepository(Doctor)
    private doctorsRepository: Repository<Doctor>,
    @InjectRepository(Appointment)
    private appointmentsRepository: Repository<Appointment>,
  ) {}

  async create(
    userId: string,
    userRole: string,
    createDto: CreateMedicalRecordDto,
  ) {
    // Only clinic users and admin can create medical records
    if (!['clinic', 'admin'].includes(userRole)) {
      throw new ForbiddenException(
        'You do not have permission to create medical records',
      );
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const clinicId = user.clinicId;
    if (!clinicId && userRole !== 'admin') {
      throw new BadRequestException('Clinic not associated with user');
    }

    // Verify patient exists and belongs to clinic
    const patient = await this.patientsRepository.findOne({
      where: { id: createDto.patientId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    if (patient.clinicId !== clinicId) {
      throw new ForbiddenException(
        'Patient does not belong to this clinic',
      );
    }

    // Verify doctor exists and belongs to clinic
    const doctor = await this.doctorsRepository.findOne({
      where: { id: createDto.doctorId },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }
    if (doctor.clinicId !== clinicId) {
      throw new ForbiddenException('Doctor does not belong to this clinic');
    }

    // If appointmentId is provided, verify it exists and belongs to clinic
    if (createDto.appointmentId) {
      const appointment = await this.appointmentsRepository.findOne({
        where: { id: createDto.appointmentId },
      });
      if (!appointment) {
        throw new NotFoundException('Appointment not found');
      }
      if (appointment.clinicId !== clinicId) {
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
      clinicId,
      visitDate: new Date(createDto.visitDate),
    });

    return this.medicalRecordsRepository.save(medicalRecord);
  }

  async findAll(
    userId: string,
    userRole: string,
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

    // Only clinic users and admin can view medical records
    if (!['clinic', 'admin'].includes(userRole)) {
      throw new ForbiddenException(
        'You do not have permission to view medical records',
      );
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Build query
    const queryBuilder = this.medicalRecordsRepository
      .createQueryBuilder('medicalRecord')
      .leftJoinAndSelect('medicalRecord.patient', 'patient')
      .leftJoinAndSelect('medicalRecord.doctor', 'doctor')
      .leftJoinAndSelect('medicalRecord.appointment', 'appointment');

    // Clinic users can only see their clinic's medical records
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
      queryBuilder.where('medicalRecord.clinicId = :clinicId', {
        clinicId: user.clinicId,
      });
    }

    // Filters
    if (patientId) {
      queryBuilder.andWhere('medicalRecord.patientId = :patientId', {
        patientId,
      });
    }

    if (doctorId) {
      queryBuilder.andWhere('medicalRecord.doctorId = :doctorId', {
        doctorId,
      });
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
      queryBuilder.andWhere('medicalRecord.visitDate <= :endDate', {
        endDate,
      });
    }

    // Order and pagination
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

  async findOne(id: string, userId: string, userRole: string) {
    const medicalRecord = await this.medicalRecordsRepository.findOne({
      where: { id },
      relations: ['clinic', 'patient', 'doctor', 'appointment'],
    });

    if (!medicalRecord) {
      throw new NotFoundException(
        `Medical record with ID ${id} not found`,
      );
    }

    // Access control
    if (userRole === 'clinic') {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user || user.clinicId !== medicalRecord.clinicId) {
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
    updateDto: UpdateMedicalRecordDto,
  ) {
    const medicalRecord = await this.findOne(id, userId, userRole);

    // If updating patient, doctor, or appointment, verify they belong to clinic
    if (updateDto.patientId && updateDto.patientId !== medicalRecord.patientId) {
      const patient = await this.patientsRepository.findOne({
        where: { id: updateDto.patientId },
      });
      if (!patient || patient.clinicId !== medicalRecord.clinicId) {
        throw new ForbiddenException(
          'Patient does not belong to this clinic',
        );
      }
    }

    if (updateDto.doctorId && updateDto.doctorId !== medicalRecord.doctorId) {
      const doctor = await this.doctorsRepository.findOne({
        where: { id: updateDto.doctorId },
      });
      if (!doctor || doctor.clinicId !== medicalRecord.clinicId) {
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
      if (!appointment || appointment.clinicId !== medicalRecord.clinicId) {
        throw new ForbiddenException(
          'Appointment does not belong to this clinic',
        );
      }
    }

    // Update fields
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
    if (updateDto.vitals !== undefined)
      medicalRecord.vitals = updateDto.vitals;
    if (updateDto.notes !== undefined)
      medicalRecord.notes = updateDto.notes;
    if (updateDto.attachments !== undefined)
      medicalRecord.attachments = updateDto.attachments;

    return this.medicalRecordsRepository.save(medicalRecord);
  }

  async remove(id: string, userId: string, userRole: string) {
    const medicalRecord = await this.findOne(id, userId, userRole);
    await this.medicalRecordsRepository.remove(medicalRecord);
    return { message: 'Medical record deleted successfully' };
  }
}



