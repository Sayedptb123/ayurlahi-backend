import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabReport, LabReportStatus } from './entities/lab-report.entity';
import { LabTest, LabTestStatus } from './entities/lab-test.entity';
import { User } from '../users/entities/user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { CreateLabReportDto } from './dto/create-lab-report.dto';
import { UpdateLabReportDto } from './dto/update-lab-report.dto';
import { GetLabReportsDto } from './dto/get-lab-reports.dto';

@Injectable()
export class LabReportsService {
  constructor(
    @InjectRepository(LabReport)
    private labReportsRepository: Repository<LabReport>,
    @InjectRepository(LabTest)
    private labTestsRepository: Repository<LabTest>,
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
    createDto: CreateLabReportDto,
  ) {
    // Only clinic users and admin can create lab reports
    if (!['clinic', 'admin'].includes(userRole)) {
      throw new ForbiddenException(
        'You do not have permission to create lab reports',
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

    // Check if reportNumber is unique
    const existingReport = await this.labReportsRepository.findOne({
      where: { reportNumber: createDto.reportNumber },
    });
    if (existingReport) {
      throw new ConflictException(
        `Report number ${createDto.reportNumber} already exists`,
      );
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

    // Validate tests
    if (!createDto.tests || createDto.tests.length === 0) {
      throw new BadRequestException('Lab report must have at least one test');
    }

    // Create lab report with tests
    const labReport = this.labReportsRepository.create({
      clinicId,
      patientId: createDto.patientId,
      appointmentId: createDto.appointmentId || null,
      doctorId: createDto.doctorId,
      reportNumber: createDto.reportNumber,
      orderDate: new Date(createDto.orderDate),
      collectionDate: createDto.collectionDate
        ? new Date(createDto.collectionDate)
        : null,
      reportDate: createDto.reportDate ? new Date(createDto.reportDate) : null,
      status: createDto.status || LabReportStatus.ORDERED,
      notes: createDto.notes || null,
      reportFile: createDto.reportFile || null,
      tests: createDto.tests.map((test) =>
        this.labTestsRepository.create({
          testName: test.testName,
          testCode: test.testCode || null,
          result: test.result || null,
          normalRange: test.normalRange || null,
          unit: test.unit || null,
          status: test.status || LabTestStatus.PENDING,
          notes: test.notes || null,
        }),
      ),
    });

    return this.labReportsRepository.save(labReport);
  }

  async findAll(
    userId: string,
    userRole: string,
    query: GetLabReportsDto,
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

    // Only clinic users and admin can view lab reports
    if (!['clinic', 'admin'].includes(userRole)) {
      throw new ForbiddenException(
        'You do not have permission to view lab reports',
      );
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Build query
    const queryBuilder = this.labReportsRepository
      .createQueryBuilder('labReport')
      .leftJoinAndSelect('labReport.patient', 'patient')
      .leftJoinAndSelect('labReport.doctor', 'doctor')
      .leftJoinAndSelect('labReport.appointment', 'appointment')
      .leftJoinAndSelect('labReport.tests', 'tests');

    // Clinic users can only see their clinic's lab reports
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
      queryBuilder.where('labReport.clinicId = :clinicId', {
        clinicId: user.clinicId,
      });
    }

    // Filters
    if (patientId) {
      queryBuilder.andWhere('labReport.patientId = :patientId', {
        patientId,
      });
    }

    if (doctorId) {
      queryBuilder.andWhere('labReport.doctorId = :doctorId', {
        doctorId,
      });
    }

    if (appointmentId) {
      queryBuilder.andWhere('labReport.appointmentId = :appointmentId', {
        appointmentId,
      });
    }

    if (status) {
      queryBuilder.andWhere('labReport.status = :status', { status });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere(
        'labReport.orderDate BETWEEN :startDate AND :endDate',
        { startDate, endDate },
      );
    } else if (startDate) {
      queryBuilder.andWhere('labReport.orderDate >= :startDate', {
        startDate,
      });
    } else if (endDate) {
      queryBuilder.andWhere('labReport.orderDate <= :endDate', {
        endDate,
      });
    }

    // Order and pagination
    queryBuilder
      .orderBy('labReport.orderDate', 'DESC')
      .addOrderBy('labReport.createdAt', 'DESC')
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
    const labReport = await this.labReportsRepository.findOne({
      where: { id },
      relations: ['clinic', 'patient', 'doctor', 'appointment', 'tests'],
    });

    if (!labReport) {
      throw new NotFoundException(`Lab report with ID ${id} not found`);
    }

    // Access control
    if (userRole === 'clinic') {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user || user.clinicId !== labReport.clinicId) {
        throw new ForbiddenException(
          'You do not have access to this lab report',
        );
      }
    }

    return labReport;
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    updateDto: UpdateLabReportDto,
  ) {
    const labReport = await this.findOne(id, userId, userRole);

    // Check reportNumber uniqueness if being updated
    if (
      updateDto.reportNumber &&
      updateDto.reportNumber !== labReport.reportNumber
    ) {
      const existingReport = await this.labReportsRepository.findOne({
        where: { reportNumber: updateDto.reportNumber },
      });
      if (existingReport) {
        throw new ConflictException(
          `Report number ${updateDto.reportNumber} already exists`,
        );
      }
    }

    // If updating patient, doctor, or appointment, verify they belong to clinic
    if (updateDto.patientId && updateDto.patientId !== labReport.patientId) {
      const patient = await this.patientsRepository.findOne({
        where: { id: updateDto.patientId },
      });
      if (!patient || patient.clinicId !== labReport.clinicId) {
        throw new ForbiddenException(
          'Patient does not belong to this clinic',
        );
      }
    }

    if (updateDto.doctorId && updateDto.doctorId !== labReport.doctorId) {
      const doctor = await this.doctorsRepository.findOne({
        where: { id: updateDto.doctorId },
      });
      if (!doctor || doctor.clinicId !== labReport.clinicId) {
        throw new ForbiddenException('Doctor does not belong to this clinic');
      }
    }

    if (
      updateDto.appointmentId &&
      updateDto.appointmentId !== labReport.appointmentId
    ) {
      const appointment = await this.appointmentsRepository.findOne({
        where: { id: updateDto.appointmentId },
      });
      if (!appointment || appointment.clinicId !== labReport.clinicId) {
        throw new ForbiddenException(
          'Appointment does not belong to this clinic',
        );
      }
    }

    // Update fields
    if (updateDto.reportNumber !== undefined)
      labReport.reportNumber = updateDto.reportNumber;
    if (updateDto.patientId !== undefined)
      labReport.patientId = updateDto.patientId;
    if (updateDto.appointmentId !== undefined)
      labReport.appointmentId = updateDto.appointmentId;
    if (updateDto.doctorId !== undefined)
      labReport.doctorId = updateDto.doctorId;
    if (updateDto.orderDate !== undefined)
      labReport.orderDate = new Date(updateDto.orderDate);
    if (updateDto.collectionDate !== undefined)
      labReport.collectionDate = updateDto.collectionDate
        ? new Date(updateDto.collectionDate)
        : null;
    if (updateDto.reportDate !== undefined)
      labReport.reportDate = updateDto.reportDate
        ? new Date(updateDto.reportDate)
        : null;
    if (updateDto.status !== undefined) labReport.status = updateDto.status;
    if (updateDto.notes !== undefined) labReport.notes = updateDto.notes;
    if (updateDto.reportFile !== undefined)
      labReport.reportFile = updateDto.reportFile;

    // Update tests if provided
    if (updateDto.tests !== undefined) {
      // Remove existing tests
      await this.labTestsRepository.delete({
        labReportId: labReport.id,
      });

      // Create new tests
      labReport.tests = updateDto.tests.map((test) =>
        this.labTestsRepository.create({
          labReportId: labReport.id,
          testName: test.testName,
          testCode: test.testCode || null,
          result: test.result || null,
          normalRange: test.normalRange || null,
          unit: test.unit || null,
          status: test.status || LabTestStatus.PENDING,
          notes: test.notes || null,
        }),
      );
    }

    return this.labReportsRepository.save(labReport);
  }

  async remove(id: string, userId: string, userRole: string) {
    const labReport = await this.findOne(id, userId, userRole);
    await this.labReportsRepository.remove(labReport);
    return { message: 'Lab report deleted successfully' };
  }
}

