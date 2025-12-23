import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prescription, PrescriptionStatus } from './entities/prescription.entity';
import { PrescriptionItem } from './entities/prescription-item.entity';
import { User } from '../users/entities/user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { GetPrescriptionsDto } from './dto/get-prescriptions.dto';

@Injectable()
export class PrescriptionsService {
  constructor(
    @InjectRepository(Prescription)
    private prescriptionsRepository: Repository<Prescription>,
    @InjectRepository(PrescriptionItem)
    private prescriptionItemsRepository: Repository<PrescriptionItem>,
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
    createDto: CreatePrescriptionDto,
  ) {
    // Only clinic users and admin can create prescriptions
    if (!['clinic', 'admin'].includes(userRole)) {
      throw new ForbiddenException(
        'You do not have permission to create prescriptions',
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

    // Validate items
    if (!createDto.items || createDto.items.length === 0) {
      throw new BadRequestException('Prescription must have at least one item');
    }

    // Create prescription with items
    const prescription = this.prescriptionsRepository.create({
      clinicId: clinicId as string,
      patientId: createDto.patientId,
      appointmentId: createDto.appointmentId || null,
      doctorId: createDto.doctorId,
      prescriptionDate: new Date(createDto.prescriptionDate),
      diagnosis: createDto.diagnosis,
      notes: createDto.notes || null,
      status: createDto.status || PrescriptionStatus.ACTIVE,
      items: createDto.items.map((item, index) =>
        this.prescriptionItemsRepository.create({
          medicineName: item.medicineName,
          dosage: item.dosage || null,
          frequency: item.frequency || null,
          duration: item.duration || null,
          quantity: item.quantity || 1,
          instructions: item.instructions || null,
          order: item.order ?? index,
        }),
      ),
    });

    return this.prescriptionsRepository.save(prescription);
  }

  async findAll(
    userId: string,
    userRole: string,
    query: GetPrescriptionsDto,
  ) {
    const {
      page = 1,
      limit = 20,
      patientId,
      doctorId,
      appointmentId,
      status,
      startDate,
      endDate,
    } = query;
    const skip = (page - 1) * limit;

    // Only clinic users and admin can view prescriptions
    if (!['clinic', 'admin'].includes(userRole)) {
      throw new ForbiddenException(
        'You do not have permission to view prescriptions',
      );
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Build query
    const queryBuilder = this.prescriptionsRepository
      .createQueryBuilder('prescription')
      .leftJoinAndSelect('prescription.patient', 'patient')
      .leftJoinAndSelect('prescription.doctor', 'doctor')
      .leftJoinAndSelect('prescription.appointment', 'appointment')
      .leftJoinAndSelect('prescription.items', 'items');

    // Clinic users can only see their clinic's prescriptions
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
      queryBuilder.where('prescription.clinicId = :clinicId', {
        clinicId: user.clinicId,
      });
    }

    // Filters
    if (patientId) {
      queryBuilder.andWhere('prescription.patientId = :patientId', {
        patientId,
      });
    }

    if (doctorId) {
      queryBuilder.andWhere('prescription.doctorId = :doctorId', {
        doctorId,
      });
    }

    if (appointmentId) {
      queryBuilder.andWhere('prescription.appointmentId = :appointmentId', {
        appointmentId,
      });
    }

    if (status) {
      queryBuilder.andWhere('prescription.status = :status', { status });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere(
        'prescription.prescriptionDate BETWEEN :startDate AND :endDate',
        { startDate, endDate },
      );
    } else if (startDate) {
      queryBuilder.andWhere('prescription.prescriptionDate >= :startDate', {
        startDate,
      });
    } else if (endDate) {
      queryBuilder.andWhere('prescription.prescriptionDate <= :endDate', {
        endDate,
      });
    }

    // Order and pagination
    queryBuilder
      .orderBy('prescription.prescriptionDate', 'DESC')
      .addOrderBy('prescription.createdAt', 'DESC')
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
    const prescription = await this.prescriptionsRepository.findOne({
      where: { id },
      relations: ['clinic', 'patient', 'doctor', 'appointment', 'items'],
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription with ID ${id} not found`);
    }

    // Access control
    if (userRole === 'clinic') {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user || user.clinicId !== prescription.clinicId) {
        throw new ForbiddenException(
          'You do not have access to this prescription',
        );
      }
    }

    return prescription;
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    updateDto: UpdatePrescriptionDto,
  ) {
    const prescription = await this.findOne(id, userId, userRole);

    // If updating patient, doctor, or appointment, verify they belong to clinic
    if (
      updateDto.patientId &&
      updateDto.patientId !== prescription.patientId
    ) {
      const patient = await this.patientsRepository.findOne({
        where: { id: updateDto.patientId },
      });
      if (!patient || patient.clinicId !== prescription.clinicId) {
        throw new ForbiddenException(
          'Patient does not belong to this clinic',
        );
      }
    }

    if (updateDto.doctorId && updateDto.doctorId !== prescription.doctorId) {
      const doctor = await this.doctorsRepository.findOne({
        where: { id: updateDto.doctorId },
      });
      if (!doctor || doctor.clinicId !== prescription.clinicId) {
        throw new ForbiddenException('Doctor does not belong to this clinic');
      }
    }

    if (
      updateDto.appointmentId &&
      updateDto.appointmentId !== prescription.appointmentId
    ) {
      const appointment = await this.appointmentsRepository.findOne({
        where: { id: updateDto.appointmentId },
      });
      if (!appointment || appointment.clinicId !== prescription.clinicId) {
        throw new ForbiddenException(
          'Appointment does not belong to this clinic',
        );
      }
    }

    // Update prescription fields
    if (updateDto.patientId !== undefined)
      prescription.patientId = updateDto.patientId;
    if (updateDto.appointmentId !== undefined)
      prescription.appointmentId = updateDto.appointmentId;
    if (updateDto.doctorId !== undefined)
      prescription.doctorId = updateDto.doctorId;
    if (updateDto.prescriptionDate !== undefined)
      prescription.prescriptionDate = new Date(updateDto.prescriptionDate);
    if (updateDto.diagnosis !== undefined)
      prescription.diagnosis = updateDto.diagnosis;
    if (updateDto.notes !== undefined) prescription.notes = updateDto.notes;
    if (updateDto.status !== undefined) prescription.status = updateDto.status;

    // Update items if provided
    if (updateDto.items !== undefined) {
      // Remove existing items
      await this.prescriptionItemsRepository.delete({
        prescriptionId: prescription.id,
      });

      // Create new items
      prescription.items = updateDto.items.map((item, index) =>
        this.prescriptionItemsRepository.create({
          prescriptionId: prescription.id,
          medicineName: item.medicineName,
          dosage: item.dosage || null,
          frequency: item.frequency || null,
          duration: item.duration || null,
          quantity: item.quantity || 1,
          instructions: item.instructions || null,
          order: item.order ?? index,
        }),
      );
    }

    return this.prescriptionsRepository.save(prescription);
  }

  async remove(id: string, userId: string, userRole: string) {
    const prescription = await this.findOne(id, userId, userRole);
    await this.prescriptionsRepository.remove(prescription);
    return { message: 'Prescription deleted successfully' };
  }
}

