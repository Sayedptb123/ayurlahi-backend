import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vital } from './entities/vital.entity';
import { CreateVitalDto } from './dto/create-vital.dto';
import { BranchScopeUser, BranchVisibilityService } from '../branch-visibility/branch-visibility.service';

@Injectable()
export class VitalsService {
  constructor(
    @InjectRepository(Vital)
    private vitalsRepository: Repository<Vital>,
    private branchVisibilityService: BranchVisibilityService,
  ) {}

  // A vital belongs to its patient's branch (branch scoping G1/G11 —
  // scope/Branch_Scoping_Remediation_Plan_2026-09-24.md).
  async getVitals(user: BranchScopeUser, organisationId: string, patientId?: string, branchId?: string): Promise<Vital[]> {
    const scope = await this.branchVisibilityService.scopeForOrganisation(user, organisationId);
    const queryBuilder = this.vitalsRepository
      .createQueryBuilder('vital')
      .leftJoin('vital.patient', 'patient')
      .where('vital.organisationId = :organisationId', { organisationId });
    this.branchVisibilityService.applyPatientBranchScope(queryBuilder, 'patient', scope);

    if (patientId) {
      queryBuilder.andWhere('vital.patientId = :patientId', { patientId });
    }

    this.branchVisibilityService.narrowToSelectedBranch(queryBuilder, 'patient.branchId', branchId, scope);

    return queryBuilder.orderBy('vital.recordedAt', 'DESC').getMany();
  }

  async createVital(
    user: BranchScopeUser,
    organisationId: string,
    patientId: string,
    dto: CreateVitalDto,
    userId: string,
  ): Promise<Vital> {
    // Also the organisation check this path never had: the patient is looked
    // up within the organisation.
    const scope = await this.branchVisibilityService.scopeForOrganisation(user, organisationId);
    await this.branchVisibilityService.assertPatientAccess(scope, organisationId, patientId);
    const vital = this.vitalsRepository.create({
      organisationId,
      patientId,
      recordedBy: userId,
      recordedAt: new Date(dto.recordedAt),
      bp: dto.bp ?? null,
      temperature: dto.temperature ?? null,
      pulse: dto.pulse ?? null,
      spo2: dto.spo2 ?? null,
      weight: dto.weight ?? null,
      height: dto.height ?? null,
      painScore: dto.painScore ?? null,
      notes: dto.notes ?? null,
    });
    return this.vitalsRepository.save(vital);
  }

  async deleteVital(user: BranchScopeUser, organisationId: string, id: string): Promise<{ message: string }> {
    const scope = await this.branchVisibilityService.scopeForOrganisation(user, organisationId);
    const vital = await this.vitalsRepository.findOne({
      where: { id, organisationId },
    });
    if (!vital) {
      throw new NotFoundException(`Vital record with ID ${id} not found`);
    }
    await this.branchVisibilityService.assertPatientAccess(scope, organisationId, vital.patientId)
      .catch(() => { throw new NotFoundException(`Vital record with ID ${id} not found`); });
    await this.vitalsRepository.softDelete(vital.id);
    return { message: 'Vital record deleted successfully' };
  }
}
