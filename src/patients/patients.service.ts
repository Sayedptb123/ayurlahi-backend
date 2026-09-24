import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, SelectQueryBuilder } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { Branch } from '../branches/entities/branch.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { GetPatientsDto } from './dto/get-patients.dto';
import { BranchScope, BranchVisibilityService } from '../branch-visibility/branch-visibility.service';
import { AuditService } from '../audit/audit.service';
import type { OrgType } from '../audit/audit.types';
import type { AuthAuditContext } from '../auth/auth.service';

// Same shape as AuthAuditContext, not re-exported from auth.service.ts
// since only the interface (not the const) is exported there. See
// scope/Audit_Trail_Phase3_Patients_Implementation_Plan.md -- renaming
// AuthAuditContext to a module-agnostic name is deferred until a third
// module needs it (Phase 1's same reasoning for not building CLS yet).
const NO_CONTEXT: AuthAuditContext = { ipAddress: null, userAgent: null };

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private patientsRepository: Repository<Patient>,
    @InjectRepository(Branch)
    private branchesRepository: Repository<Branch>,
    private branchVisibilityService: BranchVisibilityService,
    private auditService: AuditService,
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
    ctx: AuthAuditContext = NO_CONTEXT,
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

    // No phone uniqueness check: families share phones, so several patients
    // may legitimately have the same number. Duplicate hints come from
    // findVisibleByPhone() (GET /patients/possible-matches), which respects
    // branch visibility -- this used to 409 org-wide and leak the other
    // branch's patient name. See scope/patient-phone-non-unique-and-matching.md.

    // Branch scoping G10: the branch is resolved, never taken on trust. A
    // newborn registered with a mother belongs to the mother's branch (the
    // mother must be visible to the caller); otherwise the requested branch
    // must be one the caller may use, or their single usable branch (Q3).
    const scope = await this.branchVisibilityService.scopeFor({ userId, role: userRole, organisationId: clinicId });
    let mother: Patient | null = null;
    if (createDto.motherPatientId) {
      mother = await this.patientsRepository.findOne({
        where: { id: createDto.motherPatientId, organisationId: clinicId as string },
      });
      if (!mother) {
        throw new NotFoundException('Mother patient not found in this clinic');
      }
    }
    const branchId = await this.branchVisibilityService.resolveWriteBranch(scope, clinicId as string, {
      requested: createDto.branchId,
      parent: mother ? { branchId: mother.branchId } : undefined,
    });

    const patient = this.patientsRepository.create({
      organisationId: clinicId as string,
      patientCode,
      fileNumber: createDto.fileNumber || null,
      branchId,
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
      const saved = await this.patientsRepository.save(patient);
      await this.auditService.record({
        organisationId: clinicId as string,
        branchId: saved.branchId,
        orgType: organisationType as OrgType,
        entityType: 'patient',
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
    } catch (err: any) {
      if (err?.code === '23505') {
        if (err?.constraint?.includes('patient_code') || err?.constraint?.includes('patientcode')) {
          throw new ConflictException(
            `Patient ID ${patientCode} already exists in this clinic`,
          );
        }
      }
      throw err;
    }
  }

  // Organisation filter + ADR-004 D9/Phase 4 branch-level visibility. Shared
  // by the list, the possible-match lookup and promote-by-id so all three
  // agree on exactly which patients a caller can see.
  // Branch scoping v2 (scope/Branch_Scoping_Remediation_Plan_2026-09-24.md):
  // organisation filter + the shared branch scope. Restricted users no longer
  // see NULL-branch patients in an organisation that has branches (Q1).
  // Returns the scope so callers can apply the switcher on top of it.
  private async applyVisibility(
    queryBuilder: SelectQueryBuilder<Patient>,
    userId: string | undefined,
    organisationId: string,
    userRole: string | undefined,
  ): Promise<BranchScope> {
    queryBuilder.where('patient.organisationId = :organisationId', {
      organisationId,
    });
    const scope = await this.branchVisibilityService.scopeFor({ userId, role: userRole, organisationId });
    this.branchVisibilityService.applyBranchScope(queryBuilder, 'patient.branchId', scope);
    return scope;
  }

  // Patients the caller can see that share this exact phone number. Phone is
  // a contact attribute, not identity: this only ever returns candidates for
  // a human to choose from, never a patient to link automatically. A patient
  // belongs to one branch, so a branchId narrows candidates to that branch
  // (strict, like the list's switcher filter). Non-CLINIC callers get
  // nothing (deny by default).
  async findVisibleByPhone(
    userId: string | undefined,
    userRole: string | undefined,
    organisationId: string | undefined,
    organisationType: string | undefined,
    phone: string | undefined,
    manager?: EntityManager,
    branchId?: string | null,
  ): Promise<Patient[]> {
    const trimmed = phone?.trim();
    if (organisationType !== 'CLINIC' || !organisationId || !trimmed) return [];

    const repo = manager ? manager.getRepository(Patient) : this.patientsRepository;
    const queryBuilder = repo
      .createQueryBuilder('patient')
      .leftJoin('patient.branch', 'branch')
      .select([
        'patient.id',
        'patient.patientCode',
        'patient.fileNumber',
        'patient.firstName',
        'patient.lastName',
        'patient.dateOfBirth',
        'patient.gender',
        'patient.phone',
        'patient.branchId',
        // Selected because it is the sort key: take() + a join makes TypeORM
        // paginate via a DISTINCT subquery that can only order by selected
        // columns (500 "distinctAlias.patient_created_at does not exist").
        'patient.createdAt',
        'branch.id',
        'branch.name',
      ]);
    const scope = await this.applyVisibility(queryBuilder, userId, organisationId, userRole);
    this.branchVisibilityService.narrowToSelectedBranch(queryBuilder, 'patient.branchId', branchId, scope);
    queryBuilder
      .andWhere('patient.phone = :phone', { phone: trimmed })
      .orderBy('patient.createdAt', 'DESC')
      .take(20);
    return queryBuilder.getMany();
  }

  // A single patient, only if it is in the caller's organisation and visible
  // to them under branch isolation; null otherwise (caller decides 404).
  async findVisibleById(
    userId: string | undefined,
    userRole: string | undefined,
    organisationId: string,
    patientId: string,
    manager?: EntityManager,
  ): Promise<Patient | null> {
    const repo = manager ? manager.getRepository(Patient) : this.patientsRepository;
    const queryBuilder = repo.createQueryBuilder('patient');
    await this.applyVisibility(queryBuilder, userId, organisationId, userRole);
    queryBuilder.andWhere('patient.id = :patientId', { patientId });
    return queryBuilder.getOne();
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
      const scope = await this.applyVisibility(queryBuilder, userId, organisationId, userRole);

      // Branch switcher (personal view filter) — ANDed on top of the visibility
      // filter above, so it can only narrow further, never broaden it. Strict
      // match, not OR-NULL: "All Locations" is the combined view, so picking a
      // specific branch means only that branch's own records, not org-wide
      // ones too. (The visibility filter above still uses OR-NULL — that's
      // access control, not a view preference, and stays unchanged.)
      this.branchVisibilityService.narrowToSelectedBranch(queryBuilder, 'patient.branchId', branchId, scope);
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
    ctx: AuthAuditContext = NO_CONTEXT,
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

      // Branch scope, additive on top of the organisation check above. 404,
      // not 403, so ids can't be probed across branches (Q2); NULL-branch
      // patients are outside a restricted scope (Q1).
      this.branchVisibilityService.assertBranchAccess(
        await this.branchVisibilityService.scopeFor({ userId, role: userRole, organisationId }),
        patient.branchId,
        `Patient with ID ${id} not found`,
      );
    }

    // Placed after authorization succeeds -- a denied lookup isn't a
    // "view", it belongs to the unauthorized-access-attempt category
    // (module matrix Section U), out of scope for this phase, not
    // conflated with a real view here.
    await this.auditService.record({
      organisationId: patient.organisationId,
      branchId: patient.branchId,
      orgType: organisationType as OrgType,
      entityType: 'patient',
      entityId: patient.id,
      action: 'view',
      severity: 'sensitive',
      actorUserId: userId,
      actorRole: userRole,
      source: 'api',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return patient;
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    updateDto: UpdatePatientDto,
    ctx: AuthAuditContext = NO_CONTEXT,
  ) {
    const patient = await this.patientsRepository.findOne({ where: { id } });
    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }
    // Branch scope for the edit itself (G4) and for any branch move below.
    const scope = await this.branchVisibilityService.scopeFor({ userId, role: userRole, organisationId });
    if (organisationType !== 'AYURLAHI_TEAM') {
      if (!organisationId || organisationId !== patient.organisationId) {
        throw new ForbiddenException('You do not have access to this patient');
      }
      this.branchVisibilityService.assertBranchAccess(scope, patient.branchId, `Patient with ID ${id} not found`);
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

    // Before/after diff for the audit trail -- captured using the entity's
    // own property names (patientCode, not the DTO's patientId alias) and
    // the actual normalized value being assigned (e.g. the parsed Date for
    // dateOfBirth, not the raw DTO string), never the raw DTO value where
    // the two differ. Only records a key when the value actually changes,
    // matching the CRM update() precedent.
    const before: Record<string, any> = {};
    const after: Record<string, any> = {};
    const track = (key: string, oldValue: unknown, newValue: unknown) => {
      if (oldValue !== newValue) {
        before[key] = oldValue;
        after[key] = newValue;
      }
    };

    if (updateDto.firstName !== undefined) {
      track('firstName', patient.firstName, updateDto.firstName);
      patient.firstName = updateDto.firstName;
    }
    if (updateDto.lastName !== undefined) {
      track('lastName', patient.lastName, updateDto.lastName);
      patient.lastName = updateDto.lastName;
    }
    if (updateDto.patientId !== undefined) {
      track('patientCode', patient.patientCode, updateDto.patientId);
      patient.patientCode = updateDto.patientId;
    }
    if (updateDto.fileNumber !== undefined) {
      track('fileNumber', patient.fileNumber, updateDto.fileNumber);
      patient.fileNumber = updateDto.fileNumber;
    }
    if (updateDto.branchId !== undefined && updateDto.branchId !== patient.branchId) {
      // Moving a patient: the target must be a live, approved branch the
      // caller may use; never NULL in an organisation that has branches.
      const targetBranchId = await this.branchVisibilityService.resolveWriteBranch(
        scope,
        patient.organisationId,
        { requested: updateDto.branchId },
      );
      track('branchId', patient.branchId, targetBranchId);
      patient.branchId = targetBranchId;
    }
    if (updateDto.dateOfBirth !== undefined) {
      const newDateOfBirth = updateDto.dateOfBirth ? new Date(updateDto.dateOfBirth) : null;
      // Compare/store the normalized value, not the raw DTO string --
      // ISO date strings (not epoch millis) so the diff stays readable to
      // whoever eventually reads audit_logs, while still comparing by
      // actual value rather than by Date object reference.
      const oldIso = patient.dateOfBirth ? patient.dateOfBirth.toISOString().slice(0, 10) : null;
      const newIso = newDateOfBirth ? newDateOfBirth.toISOString().slice(0, 10) : null;
      track('dateOfBirth', oldIso, newIso);
      patient.dateOfBirth = newDateOfBirth;
    }
    if (updateDto.gender !== undefined) {
      track('gender', patient.gender, updateDto.gender);
      patient.gender = updateDto.gender;
    }
    if (updateDto.phone !== undefined) {
      track('phone', patient.phone, updateDto.phone);
      patient.phone = updateDto.phone;
    }
    if (updateDto.email !== undefined) {
      track('email', patient.email, updateDto.email);
      patient.email = updateDto.email;
    }
    if (updateDto.address !== undefined) {
      track('address', patient.address, updateDto.address);
      patient.address = updateDto.address;
    }
    if (updateDto.emergencyContact !== undefined) {
      track('emergencyContact', patient.emergencyContact, updateDto.emergencyContact);
      patient.emergencyContact = updateDto.emergencyContact;
    }
    if (updateDto.bloodGroup !== undefined) {
      track('bloodGroup', patient.bloodGroup, updateDto.bloodGroup);
      patient.bloodGroup = updateDto.bloodGroup;
    }
    if (updateDto.allergies !== undefined) {
      track('allergies', patient.allergies, updateDto.allergies);
      patient.allergies = updateDto.allergies;
    }
    if (updateDto.medicalHistory !== undefined) {
      track('medicalHistory', patient.medicalHistory, updateDto.medicalHistory);
      patient.medicalHistory = updateDto.medicalHistory;
    }

    patient.updatedBy = userId;

    const saved = await this.patientsRepository.save(patient);

    if (Object.keys(after).length > 0) {
      await this.auditService.record({
        organisationId: patient.organisationId,
        branchId: saved.branchId,
        orgType: organisationType as OrgType,
        entityType: 'patient',
        entityId: saved.id,
        action: 'update',
        severity: 'sensitive',
        actorUserId: userId,
        actorRole: userRole,
        source: 'api',
        changes: Object.fromEntries(
          Object.keys(after).map((k) => [k, { from: before[k], to: after[k] }]),
        ),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    }

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
    // findOne() below already emits its own `view` event -- accepted as
    // an honest side effect (the deleter did look at the record first),
    // not routed around with a second internal-only lookup. Decision F,
    // scope/Audit_Trail_Phase3_Patients_Reconnaissance.md.
    const patient = await this.findOne(
      id,
      userId,
      userRole,
      organisationId,
      organisationType,
      ctx,
    );

    // Critical severity: the soft-delete and its audit record must commit
    // together or not at all (v4's durability policy). No pessimistic
    // lock needed here, unlike AuthService.resetPassword() -- softDelete()
    // is a pure state assignment with no prior read to go stale against,
    // so manager.transaction() alone provides the needed guarantee.
    await this.patientsRepository.manager.transaction(async (manager) => {
      await manager.getRepository(Patient).softDelete(patient.id);
      await this.auditService.record(
        {
          organisationId: patient.organisationId,
          branchId: patient.branchId,
          orgType: organisationType as OrgType,
          entityType: 'patient',
          entityId: patient.id,
          action: 'soft_delete',
          severity: 'critical',
          actorUserId: userId,
          actorRole: userRole,
          source: 'api',
          metadata: { patientCode: patient.patientCode },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        manager,
      );
    });

    return { message: 'Patient deleted successfully' };
  }
}
