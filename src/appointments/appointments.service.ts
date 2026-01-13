import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { User } from '../users/entities/user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { GetAppointmentsDto } from './dto/get-appointments.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentsRepository: Repository<Appointment>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Patient)
    private patientsRepository: Repository<Patient>,
    @InjectRepository(Doctor)
    private doctorsRepository: Repository<Doctor>,
  ) { }

  async create(
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    createDto: CreateAppointmentDto,
  ) {
    // Only clinic users and admin can create appointments
    if (
      organisationType !== 'CLINIC' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'SUPPORT'
    ) {
      throw new ForbiddenException(
        'You do not have permission to create appointments',
      );
    }

    // Get clinicId from organisationId (in new structure, clinic is an organisation)
    const clinicId = organisationId;
    if (!clinicId && userRole !== 'SUPER_ADMIN' && userRole !== 'SUPPORT') {
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
      throw new ForbiddenException('Patient does not belong to this clinic');
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
    if (!doctor.isActive) {
      throw new BadRequestException('Doctor is not active');
    }

    // Check for overlapping appointments
    const duration = createDto.duration ?? 30;
    const newStartTime = createDto.appointmentTime;
    const [newHours, newMinutes] = newStartTime.split(':').map(Number);
    const newStartMinutes = newHours * 60 + newMinutes;
    const newEndMinutes = newStartMinutes + duration;

    // Get existing appointments for the same doctor and date
    const existingAppointments = await this.appointmentsRepository
      .createQueryBuilder('appointment')
      .where('appointment.doctorId = :doctorId', {
        doctorId: createDto.doctorId,
      })
      .andWhere('appointment.appointmentDate = :date', {
        date: createDto.appointmentDate,
      })
      .andWhere('appointment.status NOT IN (:...statuses)', {
        statuses: [
          AppointmentStatus.CANCELLED,
          AppointmentStatus.COMPLETED,
          AppointmentStatus.NO_SHOW,
        ],
      })
      .getMany();

    // Check for time overlaps
    for (const existing of existingAppointments) {
      const [existingHours, existingMinutes] = existing.appointmentTime
        .split(':')
        .map(Number);
      const existingStartMinutes = existingHours * 60 + existingMinutes;
      const existingEndMinutes =
        existingStartMinutes + (existing.duration || 30);

      // Check if time ranges overlap
      if (
        (newStartMinutes < existingEndMinutes &&
          newEndMinutes > existingStartMinutes) ||
        (existingStartMinutes < newEndMinutes &&
          existingEndMinutes > newStartMinutes)
      ) {
        throw new ConflictException(
          'Appointment time conflicts with an existing appointment',
        );
      }
    }

    const appointment = this.appointmentsRepository.create({
      ...createDto,
      clinicId,
      appointmentDate: new Date(createDto.appointmentDate),
      duration: createDto.duration ?? 30,
      status: createDto.status ?? AppointmentStatus.SCHEDULED,
      appointmentType: createDto.appointmentType ?? createDto.appointmentType,
    });

    return this.appointmentsRepository.save(appointment);
  }

  async findAll(
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    query: GetAppointmentsDto,
  ) {
    const {
      page = 1,
      limit = 20,
      patientId,
      doctorId,
      appointmentDate,
      startDate,
      endDate,
      status,
      appointmentType,
    } = query;
    const skip = (page - 1) * limit;

    // Only clinic users and admin can view appointments
    if (
      organisationType !== 'CLINIC' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'SUPPORT'
    ) {
      throw new ForbiddenException(
        'You do not have permission to view appointments',
      );
    }

    // Build query
    const queryBuilder = this.appointmentsRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.doctor', 'doctor');

    // Clinic users can only see their clinic's appointments
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
      queryBuilder.where('appointment.clinicId = :clinicId', {
        clinicId: organisationId,
      });
    }

    // Filters
    if (patientId) {
      queryBuilder.andWhere('appointment.patientId = :patientId', {
        patientId,
      });
    }

    if (doctorId) {
      queryBuilder.andWhere('appointment.doctorId = :doctorId', {
        doctorId,
      });
    }

    if (appointmentDate) {
      queryBuilder.andWhere('appointment.appointmentDate = :appointmentDate', {
        appointmentDate,
      });
    } else if (startDate && endDate) {
      queryBuilder.andWhere(
        'appointment.appointmentDate BETWEEN :startDate AND :endDate',
        { startDate, endDate },
      );
    }

    if (status) {
      queryBuilder.andWhere('appointment.status = :status', { status });
    }

    if (appointmentType) {
      queryBuilder.andWhere('appointment.appointmentType = :appointmentType', {
        appointmentType,
      });
    }

    // Order and pagination
    queryBuilder
      .orderBy('appointment.appointmentDate', 'ASC')
      .addOrderBy('appointment.appointmentTime', 'ASC')
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      pagination: {
        total,
        page,
        limit,
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
    const appointment = await this.appointmentsRepository.findOne({
      where: { id },
      relations: ['clinic', 'patient', 'doctor'],
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    // Access control
    if (organisationType === 'CLINIC') {
      if (!organisationId || organisationId !== appointment.clinicId) {
        throw new ForbiddenException(
          'You do not have access to this appointment',
        );
      }
    }

    return appointment;
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    updateDto: UpdateAppointmentDto,
  ) {
    const appointment = await this.findOne(
      id,
      userId,
      userRole,
      organisationId,
      organisationType,
    );

    // If updating patient or doctor, verify they belong to the clinic
    if (updateDto.patientId && updateDto.patientId !== appointment.patientId) {
      const patient = await this.patientsRepository.findOne({
        where: { id: updateDto.patientId },
      });
      if (!patient || patient.clinicId !== appointment.clinicId) {
        throw new ForbiddenException('Patient does not belong to this clinic');
      }
    }

    if (updateDto.doctorId && updateDto.doctorId !== appointment.doctorId) {
      const doctor = await this.doctorsRepository.findOne({
        where: { id: updateDto.doctorId },
      });
      if (!doctor || doctor.clinicId !== appointment.clinicId) {
        throw new ForbiddenException('Doctor does not belong to this clinic');
      }
    }

    // If cancelling, set cancelledAt and cancellationReason
    if (
      updateDto.status === AppointmentStatus.CANCELLED &&
      appointment.status !== AppointmentStatus.CANCELLED
    ) {
      appointment.cancelledAt = new Date();
      appointment.cancellationReason =
        updateDto.cancellationReason || 'Cancelled by user';
    }

    // Update fields
    if (updateDto.patientId !== undefined)
      appointment.patientId = updateDto.patientId;
    if (updateDto.doctorId !== undefined)
      appointment.doctorId = updateDto.doctorId;
    if (updateDto.appointmentDate !== undefined)
      appointment.appointmentDate = new Date(updateDto.appointmentDate);
    if (updateDto.appointmentTime !== undefined)
      appointment.appointmentTime = updateDto.appointmentTime;
    if (updateDto.duration !== undefined)
      appointment.duration = updateDto.duration;
    if (updateDto.status !== undefined) appointment.status = updateDto.status;
    if (updateDto.appointmentType !== undefined)
      appointment.appointmentType = updateDto.appointmentType;
    if (updateDto.reason !== undefined) appointment.reason = updateDto.reason;
    if (updateDto.notes !== undefined) appointment.notes = updateDto.notes;

    return this.appointmentsRepository.save(appointment);
  }

  async remove(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
  ) {
    const appointment = await this.findOne(
      id,
      userId,
      userRole,
      organisationId,
      organisationType,
    );
    await this.appointmentsRepository.remove(appointment);
    return { message: 'Appointment deleted successfully' };
  }
}
