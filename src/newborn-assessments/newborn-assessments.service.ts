import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { NewbornAssessment } from './entities/newborn-assessment.entity';
import { CreateNewbornAssessmentDto } from './dto/create-newborn-assessment.dto';
import { BranchScopeUser, BranchVisibilityService } from '../branch-visibility/branch-visibility.service';

@Injectable()
export class NewbornAssessmentsService {
  constructor(
    @InjectRepository(NewbornAssessment)
    private newbornAssessmentsRepository: Repository<NewbornAssessment>,
    private branchVisibilityService: BranchVisibilityService,
  ) {}

  // An assessment belongs to the baby patient's branch (branch scoping
  // G1/G11 — scope/Branch_Scoping_Remediation_Plan_2026-09-24.md).
  async getAssessments(user: BranchScopeUser, organisationId: string, patientId?: string, branchId?: string): Promise<NewbornAssessment[]> {
    const scope = await this.branchVisibilityService.scopeForOrganisation(user, organisationId);
    // No ManyToOne relation defined on this entity, so join to patients by raw table/condition.
    const queryBuilder = this.newbornAssessmentsRepository
      .createQueryBuilder('assessment')
      .leftJoin('patients', 'patient', 'patient.id = assessment.patientId')
      .where('assessment.organisationId = :organisationId', { organisationId })
      .andWhere('assessment.deletedAt IS NULL');
    this.branchVisibilityService.applyBranchScope(queryBuilder, 'patient.branch_id', scope);
    this.branchVisibilityService.narrowToSelectedBranch(queryBuilder, 'patient.branch_id', branchId, scope);

    if (patientId) {
      queryBuilder.andWhere('assessment.patientId = :patientId', { patientId });
    }

    return queryBuilder.orderBy('assessment.assessmentTime', 'DESC').getMany();
  }

  async createAssessment(
    user: BranchScopeUser,
    organisationId: string,
    dto: CreateNewbornAssessmentDto,
    userId: string,
  ): Promise<NewbornAssessment> {
    const scope = await this.branchVisibilityService.scopeForOrganisation(user, organisationId);
    await this.branchVisibilityService.assertPatientAccess(scope, organisationId, dto.patientId);
    const assessment = this.newbornAssessmentsRepository.create({
      organisationId,
      patientId: dto.patientId,
      assessedBy: userId,
      assessmentTime: new Date(dto.assessmentTime),
      assessmentType: dto.assessmentType,
      appearance: dto.appearance ?? null,
      pulse: dto.pulse ?? null,
      grimace: dto.grimace ?? null,
      activity: dto.activity ?? null,
      respiration: dto.respiration ?? null,
      apgarTotal: dto.apgarTotal ?? null,
      weight: dto.weight ?? null,
      length: dto.length ?? null,
      headCircumference: dto.headCircumference ?? null,
      jaundiceLevel: dto.jaundiceLevel ?? null,
      notes: dto.notes ?? null,
    });
    return this.newbornAssessmentsRepository.save(assessment);
  }

  async deleteAssessment(user: BranchScopeUser, organisationId: string, id: string): Promise<{ message: string }> {
    const scope = await this.branchVisibilityService.scopeForOrganisation(user, organisationId);
    const assessment = await this.newbornAssessmentsRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
    });
    if (!assessment) {
      throw new NotFoundException(`Newborn assessment with ID ${id} not found`);
    }
    await this.branchVisibilityService.assertPatientAccess(scope, organisationId, assessment.patientId)
      .catch(() => { throw new NotFoundException(`Newborn assessment with ID ${id} not found`); });
    assessment.deletedAt = new Date();
    await this.newbornAssessmentsRepository.save(assessment);
    return { message: 'Newborn assessment deleted successfully' };
  }
}
