import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Prescription,
  PrescriptionStatus,
} from './entities/prescription.entity';
import { PrescriptionItem } from './entities/prescription-item.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Staff } from '../staff/entities/staff.entity';
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
    createDto: CreatePrescriptionDto,
  ) {
    if (
      organisationType !== 'CLINIC' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'SUPPORT'
    ) {
      throw new ForbiddenException(
        'You do not have permission to create prescriptions',
      );
    }

    if (
      userRole !== 'DOCTOR' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'SUPPORT'
    ) {
      throw new ForbiddenException('Only doctors can write prescriptions');
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

    if (!createDto.items || createDto.items.length === 0) {
      throw new BadRequestException('Prescription must have at least one item');
    }

    const prescription = this.prescriptionsRepository.create({
      organisationId: clinicId,
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
    organisationId: string | undefined,
    organisationType: string | undefined,
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

    if (
      organisationType !== 'CLINIC' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'SUPPORT'
    ) {
      throw new ForbiddenException(
        'You do not have permission to view prescriptions',
      );
    }

    const queryBuilder = this.prescriptionsRepository
      .createQueryBuilder('prescription')
      .leftJoinAndSelect('prescription.patient', 'patient')
      .leftJoinAndSelect('prescription.doctor', 'doctor')
      .leftJoinAndSelect('prescription.appointment', 'appointment')
      .leftJoinAndSelect('prescription.items', 'items');

    if (organisationType === 'CLINIC') {
      if (!organisationId) {
        return { data: [], total: 0, page, limit, totalPages: 0 };
      }
      queryBuilder.where('prescription.organisationId = :organisationId', {
        organisationId,
      });
    }

    if (patientId) {
      queryBuilder.andWhere('prescription.patientId = :patientId', { patientId });
    }

    if (doctorId) {
      queryBuilder.andWhere('prescription.doctorId = :doctorId', { doctorId });
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

    queryBuilder
      .orderBy('prescription.prescriptionDate', 'DESC')
      .addOrderBy('prescription.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
  ) {
    const prescription = await this.prescriptionsRepository.findOne({
      where: { id },
      relations: ['patient', 'doctor', 'appointment', 'items'],
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription with ID ${id} not found`);
    }

    if (organisationType === 'CLINIC') {
      if (!organisationId || organisationId !== prescription.organisationId) {
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
    organisationId: string | undefined,
    organisationType: string | undefined,
    updateDto: UpdatePrescriptionDto,
  ) {
    const prescription = await this.prescriptionsRepository.findOne({
      where: { id },
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription with ID ${id} not found`);
    }

    if (organisationType === 'CLINIC') {
      if (
        !organisationId ||
        organisationId !== prescription.organisationId
      ) {
        throw new ForbiddenException(
          'You do not have access to this prescription',
        );
      }
    }

    if (updateDto.patientId && updateDto.patientId !== prescription.patientId) {
      const patient = await this.patientsRepository.findOne({
        where: { id: updateDto.patientId },
      });
      if (!patient || patient.organisationId !== prescription.organisationId) {
        throw new ForbiddenException('Patient does not belong to this clinic');
      }
    }

    if (updateDto.doctorId && updateDto.doctorId !== prescription.doctorId) {
      const doctor = await this.staffRepository.findOne({
        where: { id: updateDto.doctorId },
      });
      if (!doctor || doctor.organisationId !== prescription.organisationId) {
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
      if (
        !appointment ||
        appointment.organisationId !== prescription.organisationId
      ) {
        throw new ForbiddenException(
          'Appointment does not belong to this clinic',
        );
      }
    }

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

    if (updateDto.items !== undefined) {
      await this.prescriptionItemsRepository.delete({
        prescriptionId: prescription.id,
      });
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

  async remove(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
  ) {
    const prescription = await this.findOne(
      id,
      userId,
      userRole,
      organisationId,
      organisationType,
    );
    await this.prescriptionsRepository.softDelete(prescription.id);
    return { message: 'Prescription deleted successfully' };
  }
}
