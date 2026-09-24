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
import { BranchVisibilityService } from '../branch-visibility/branch-visibility.service';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { GetPrescriptionsDto } from './dto/get-prescriptions.dto';
import { AuditService } from '../audit/audit.service';
import type { OrgType } from '../audit/audit.types';
import type { AuthAuditContext } from '../auth/auth.service';

// Same shape as AuthAuditContext -- see patients.service.ts for why this
// is a local const rather than importing one from auth.service.ts (only
// the interface is exported there).
const NO_CONTEXT: AuthAuditContext = { ipAddress: null, userAgent: null };

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
    private auditService: AuditService,
    private branchVisibilityService: BranchVisibilityService,
  ) {}

  // A prescription belongs to its patient's branch (branch scoping G1/G11 —
  // scope/Branch_Scoping_Remediation_Plan_2026-09-24.md).
  private scopeFor(userId: string, userRole: string, organisationId: string | undefined) {
    return this.branchVisibilityService.scopeFor({ userId, role: userRole, organisationId });
  }

  // Edits act on the record's patient: that patient (and any new patient the
  // record is moved to) must be inside the caller's branch scope; 404 otherwise.
  private async assertRecordPatientAccess(
    userId: string,
    userRole: string,
    organisationId: string,
    patientId: string,
    notFoundMessage: string,
  ) {
    const scope = await this.scopeFor(userId, userRole, organisationId);
    try {
      await this.branchVisibilityService.assertPatientAccess(scope, organisationId, patientId);
    } catch {
      throw new NotFoundException(notFoundMessage);
    }
  }

  async create(
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    createDto: CreatePrescriptionDto,
    ctx: AuthAuditContext = NO_CONTEXT,
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

    const canPrescribe = ['DOCTOR', 'SUPER_ADMIN', 'SUPPORT', 'OWNER', 'MANAGER', 'ADMIN'];
    if (!canPrescribe.includes(userRole)) {
      throw new ForbiddenException('Only clinic staff can write prescriptions');
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
    this.branchVisibilityService.assertBranchAccess(
      await this.scopeFor(userId, userRole, clinicId),
      patient.branchId,
      'Patient not found',
    );

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

    const saved = await this.prescriptionsRepository.save(prescription);
    await this.auditService.record({
      organisationId: clinicId as string,
      branchId: null, // Prescription has no branch column
      orgType: organisationType as OrgType,
      entityType: 'prescription',
      entityId: saved.id,
      action: 'create',
      severity: 'sensitive',
      actorUserId: userId,
      actorRole: userRole,
      source: 'api',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return saved;
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
      branchId,
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

    const scope = await this.scopeFor(userId, userRole, organisationId);
    if (organisationType === 'CLINIC') {
      if (!organisationId) {
        return { data: [], total: 0, page, limit, totalPages: 0 };
      }
      queryBuilder.where('prescription.organisationId = :organisationId', {
        organisationId,
      });
      this.branchVisibilityService.applyPatientBranchScope(queryBuilder, 'patient', scope);
    }

    queryBuilder.andWhere('prescription.deletedAt IS NULL');

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

    this.branchVisibilityService.narrowToSelectedBranch(queryBuilder, 'patient.branchId', branchId, scope);

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
    ctx: AuthAuditContext = NO_CONTEXT,
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
      this.branchVisibilityService.assertBranchAccess(
        await this.scopeFor(userId, userRole, organisationId),
        prescription.patient?.branchId,
        `Prescription with ID ${id} not found`,
      );
    } else if (userRole !== 'SUPER_ADMIN' && userRole !== 'SUPPORT') {
      // SEC-7: unknown/missing organisationType must never read a prescription.
      throw new ForbiddenException(
        'You do not have access to this prescription',
      );
    }

    await this.auditService.record({
      organisationId: prescription.organisationId,
      branchId: null,
      orgType: organisationType as OrgType,
      entityType: 'prescription',
      entityId: prescription.id,
      action: 'view',
      severity: 'sensitive',
      actorUserId: userId,
      actorRole: userRole,
      source: 'api',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return prescription;
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    updateDto: UpdatePrescriptionDto,
    ctx: AuthAuditContext = NO_CONTEXT,
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
      await this.assertRecordPatientAccess(userId, userRole, organisationId, prescription.patientId, `Prescription with ID ${id} not found`);
    } else if (userRole !== 'SUPER_ADMIN' && userRole !== 'SUPPORT') {
      // SEC-7: unknown/missing organisationType must never edit a prescription.
      throw new ForbiddenException(
        'You do not have access to this prescription',
      );
    }

    if (updateDto.patientId && updateDto.patientId !== prescription.patientId) {
      const patient = await this.patientsRepository.findOne({
        where: { id: updateDto.patientId },
      });
      if (!patient || patient.organisationId !== prescription.organisationId) {
        throw new ForbiddenException('Patient does not belong to this clinic');
      }
      await this.assertRecordPatientAccess(userId, userRole, prescription.organisationId, patient.id, 'Patient not found');
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

    // Before/after diff for the parent scalar fields -- same discipline
    // as PatientsService.update(): entity's own property names, actual
    // normalized value where the code normalizes one (prescriptionDate),
    // only recorded when it actually changes.
    const before: Record<string, any> = {};
    const after: Record<string, any> = {};
    const track = (key: string, oldValue: unknown, newValue: unknown) => {
      if (oldValue !== newValue) {
        before[key] = oldValue;
        after[key] = newValue;
      }
    };

    if (updateDto.patientId !== undefined) {
      track('patientId', prescription.patientId, updateDto.patientId);
      prescription.patientId = updateDto.patientId;
    }
    if (updateDto.appointmentId !== undefined) {
      track('appointmentId', prescription.appointmentId, updateDto.appointmentId);
      prescription.appointmentId = updateDto.appointmentId;
    }
    if (updateDto.doctorId !== undefined) {
      track('doctorId', prescription.doctorId, updateDto.doctorId);
      prescription.doctorId = updateDto.doctorId;
    }
    if (updateDto.prescriptionDate !== undefined) {
      const newDate = new Date(updateDto.prescriptionDate);
      const oldIso = prescription.prescriptionDate
        ? new Date(prescription.prescriptionDate).toISOString().slice(0, 10)
        : null;
      track('prescriptionDate', oldIso, newDate.toISOString().slice(0, 10));
      prescription.prescriptionDate = newDate;
    }
    if (updateDto.diagnosis !== undefined) {
      track('diagnosis', prescription.diagnosis, updateDto.diagnosis);
      prescription.diagnosis = updateDto.diagnosis;
    }
    if (updateDto.notes !== undefined) {
      track('notes', prescription.notes, updateDto.notes);
      prescription.notes = updateDto.notes;
    }
    if (updateDto.status !== undefined) {
      track('status', prescription.status, updateDto.status);
      prescription.status = updateDto.status;
    }

    // Items snapshot (decision B) -- read before any deletion, outside
    // the transaction (same reasoning as the parent before/after values:
    // the write+audit pairing is what needs atomicity, not this read).
    // Exactly these six fields, mapped explicitly, never the whole
    // entity spread -- a future PrescriptionItem column shouldn't
    // silently start appearing in audit metadata unreviewed.
    //
    // normalizedItems is built ONCE and used for both the audit
    // itemsAfter snapshot and the actual persisted entities below --
    // review caught that an earlier draft normalized these independently
    // (`??` in the audit snapshot vs `||` in the persistence path), which
    // could theoretically disagree for a falsy-but-not-nullish value
    // (e.g. quantity: 0). Sharing one array makes that discrepancy
    // structurally impossible rather than relying on DTO validation to
    // rule it out.
    let itemsMetadata: Record<string, unknown> | null = null;
    let normalizedItems: Array<{
      prescriptionId: string; medicineName: string; dosage: string | null;
      frequency: string | null; duration: string | null; quantity: number;
      instructions: string | null; order: number;
    }> = [];
    if (updateDto.items !== undefined) {
      const existingItems = await this.prescriptionItemsRepository.find({
        where: { prescriptionId: prescription.id },
      });
      normalizedItems = updateDto.items.map((item, index) => ({
        prescriptionId: prescription.id,
        medicineName: item.medicineName,
        dosage: item.dosage || null,
        frequency: item.frequency || null,
        duration: item.duration || null,
        quantity: item.quantity || 1,
        instructions: item.instructions || null,
        order: item.order ?? index,
      }));
      itemsMetadata = {
        itemsBefore: existingItems.map((i) => ({
          medicineName: i.medicineName, dosage: i.dosage, frequency: i.frequency,
          duration: i.duration, quantity: i.quantity, instructions: i.instructions,
        })),
        itemsAfter: normalizedItems.map((i) => ({
          medicineName: i.medicineName, dosage: i.dosage, frequency: i.frequency,
          duration: i.duration, quantity: i.quantity, instructions: i.instructions,
        })),
      };
    }

    const hasChanges = Object.keys(after).length > 0 || itemsMetadata !== null;

    // Critical severity: the items soft-delete, the cascade-inserted
    // replacements, the parent save, and the audit record all commit
    // together or not at all -- v4's durability policy for critical
    // events. The items softDelete() specifically MUST run on the
    // transactional manager, not the injected repository, or this
    // guarantee doesn't actually hold for it (see
    // scope/Audit_Trail_Phase4_Prescriptions_Implementation_Plan.md).
    const saved = await this.prescriptionsRepository.manager.transaction(async (manager) => {
      if (updateDto.items !== undefined) {
        await manager.getRepository(PrescriptionItem).softDelete({
          prescriptionId: prescription.id,
        });
        prescription.items = normalizedItems.map((item) =>
          this.prescriptionItemsRepository.create(item),
        );
      }

      const savedPrescription = await manager.save(Prescription, prescription);

      if (hasChanges) {
        await this.auditService.record(
          {
            organisationId: prescription.organisationId,
            branchId: null,
            orgType: organisationType as OrgType,
            entityType: 'prescription',
            entityId: savedPrescription.id,
            action: 'update',
            severity: 'critical',
            actorUserId: userId,
            actorRole: userRole,
            source: 'api',
            changes: Object.keys(after).length > 0
              ? Object.fromEntries(Object.keys(after).map((k) => [k, { from: before[k], to: after[k] }]))
              : null,
            metadata: itemsMetadata,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
          },
          manager,
        );
      }

      return savedPrescription;
    });

    return saved;
  }

  async remove(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    ctx: AuthAuditContext = NO_CONTEXT,
  ) {
    // findOne() below already emits its own `view` event -- accepted per
    // decision F, matching Patients.
    const prescription = await this.findOne(
      id,
      userId,
      userRole,
      organisationId,
      organisationType,
      ctx,
    );

    await this.prescriptionsRepository.manager.transaction(async (manager) => {
      await manager.getRepository(Prescription).softDelete(prescription.id);
      await this.auditService.record(
        {
          organisationId: prescription.organisationId,
          branchId: null,
          orgType: organisationType as OrgType,
          entityType: 'prescription',
          entityId: prescription.id,
          action: 'soft_delete',
          severity: 'critical',
          actorUserId: userId,
          actorRole: userRole,
          source: 'api',
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        manager,
      );
    });

    return { message: 'Prescription deleted successfully' };
  }
}
