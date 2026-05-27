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
import { Patient } from '../patients/entities/patient.entity';
import { Staff } from '../staff/entities/staff.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { CreateLabReportDto } from './dto/create-lab-report.dto';
import { UpdateLabReportDto } from './dto/update-lab-report.dto';
import { GetLabReportsDto } from './dto/get-lab-reports.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LabReportsService {
  constructor(
    @InjectRepository(LabReport)
    private labReportsRepository: Repository<LabReport>,
    @InjectRepository(LabTest)
    private labTestsRepository: Repository<LabTest>,
    @InjectRepository(Patient)
    private patientsRepository: Repository<Patient>,
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @InjectRepository(Appointment)
    private appointmentsRepository: Repository<Appointment>,
    private notificationsService: NotificationsService,
  ) {}

  async create(
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    createDto: CreateLabReportDto,
  ) {
    if (
      organisationType !== 'CLINIC' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'SUPPORT'
    ) {
      throw new ForbiddenException(
        'You do not have permission to create lab reports',
      );
    }

    const clinicId = organisationId;
    if (!clinicId && userRole !== 'SUPER_ADMIN' && userRole !== 'SUPPORT') {
      throw new BadRequestException('Clinic not associated with user');
    }

    // Check reportNumber uniqueness within this organisation
    const existingReport = await this.labReportsRepository.findOne({
      where: { reportNumber: createDto.reportNumber, organisationId: clinicId },
    });
    if (existingReport) {
      throw new ConflictException(
        `Report number ${createDto.reportNumber} already exists`,
      );
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

    if (!createDto.tests || createDto.tests.length === 0) {
      throw new BadRequestException('Lab report must have at least one test');
    }

    const labReport = this.labReportsRepository.create({
      organisationId: clinicId,
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
    organisationId: string | undefined,
    organisationType: string | undefined,
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

    if (
      organisationType !== 'CLINIC' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'SUPPORT'
    ) {
      throw new ForbiddenException(
        'You do not have permission to view lab reports',
      );
    }

    const queryBuilder = this.labReportsRepository
      .createQueryBuilder('labReport')
      .leftJoinAndSelect('labReport.patient', 'patient')
      .leftJoinAndSelect('labReport.doctor', 'doctor')
      .leftJoinAndSelect('labReport.appointment', 'appointment')
      .leftJoinAndSelect('labReport.tests', 'tests');

    if (organisationType === 'CLINIC') {
      if (!organisationId) {
        return { data: [], total: 0, page, limit, totalPages: 0 };
      }
      queryBuilder.where('labReport.organisationId = :organisationId', {
        organisationId,
      });
    }

    if (patientId) {
      queryBuilder.andWhere('labReport.patientId = :patientId', { patientId });
    }

    if (doctorId) {
      queryBuilder.andWhere('labReport.doctorId = :doctorId', { doctorId });
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
      queryBuilder.andWhere('labReport.orderDate >= :startDate', { startDate });
    } else if (endDate) {
      queryBuilder.andWhere('labReport.orderDate <= :endDate', { endDate });
    }

    queryBuilder
      .orderBy('labReport.orderDate', 'DESC')
      .addOrderBy('labReport.createdAt', 'DESC')
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
    const labReport = await this.labReportsRepository.findOne({
      where: { id },
      relations: ['patient', 'doctor', 'appointment', 'tests'],
    });

    if (!labReport) {
      throw new NotFoundException(`Lab report with ID ${id} not found`);
    }

    if (organisationType === 'CLINIC') {
      if (!organisationId || organisationId !== labReport.organisationId) {
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
    organisationId: string | undefined,
    organisationType: string | undefined,
    updateDto: UpdateLabReportDto,
  ) {
    const labReport = await this.labReportsRepository.findOne({ where: { id } });

    if (!labReport) {
      throw new NotFoundException(`Lab report with ID ${id} not found`);
    }

    if (organisationType === 'CLINIC') {
      if (!organisationId || organisationId !== labReport.organisationId) {
        throw new ForbiddenException(
          'You do not have access to this lab report',
        );
      }
    }

    if (
      updateDto.reportNumber &&
      updateDto.reportNumber !== labReport.reportNumber
    ) {
      const existingReport = await this.labReportsRepository.findOne({
        where: {
          reportNumber: updateDto.reportNumber,
          organisationId: labReport.organisationId,
        },
      });
      if (existingReport) {
        throw new ConflictException(
          `Report number ${updateDto.reportNumber} already exists`,
        );
      }
    }

    if (updateDto.patientId && updateDto.patientId !== labReport.patientId) {
      const patient = await this.patientsRepository.findOne({
        where: { id: updateDto.patientId },
      });
      if (!patient || patient.organisationId !== labReport.organisationId) {
        throw new ForbiddenException('Patient does not belong to this clinic');
      }
    }

    if (updateDto.doctorId && updateDto.doctorId !== labReport.doctorId) {
      const doctor = await this.staffRepository.findOne({
        where: { id: updateDto.doctorId },
      });
      if (!doctor || doctor.organisationId !== labReport.organisationId) {
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
      if (
        !appointment ||
        appointment.organisationId !== labReport.organisationId
      ) {
        throw new ForbiddenException(
          'Appointment does not belong to this clinic',
        );
      }
    }

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

    if (updateDto.tests !== undefined) {
      await this.labTestsRepository.delete({ labReportId: labReport.id });
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

    const previousStatus = labReport.status;
    const saved = await this.labReportsRepository.save(labReport);

    // Notify ordering doctor when results are ready
    if (updateDto.status === LabReportStatus.COMPLETED && previousStatus !== LabReportStatus.COMPLETED) {
      const doctor = await this.staffRepository.findOne({ where: { id: saved.doctorId } });
      if (doctor?.userId) {
        const patient = await this.patientsRepository.findOne({ where: { id: saved.patientId } });
        const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'your patient';
        this.notificationsService.sendToUsers({
          userIds: [doctor.userId],
          title: 'Lab Results Ready',
          body: `Lab report ${saved.reportNumber} for ${patientName} is ready`,
          data: { labReportId: saved.id, type: 'lab_results_ready' },
        }).catch(() => {});
      }
    }

    return saved;
  }

  async remove(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
  ) {
    const labReport = await this.findOne(
      id,
      userId,
      userRole,
      organisationId,
      organisationType,
    );
    await this.labReportsRepository.softDelete(labReport.id);
    return { message: 'Lab report deleted successfully' };
  }
}
