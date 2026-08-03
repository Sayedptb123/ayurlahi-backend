import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { NewbornAssessment } from './entities/newborn-assessment.entity';
import { CreateNewbornAssessmentDto } from './dto/create-newborn-assessment.dto';

@Injectable()
export class NewbornAssessmentsService {
  constructor(
    @InjectRepository(NewbornAssessment)
    private newbornAssessmentsRepository: Repository<NewbornAssessment>,
  ) {}

  async getAssessments(organisationId: string, patientId?: string, branchId?: string): Promise<NewbornAssessment[]> {
    if (!branchId) {
      const where: any = { organisationId, deletedAt: IsNull() };
      if (patientId) {
        where.patientId = patientId;
      }
      return this.newbornAssessmentsRepository.find({
        where,
        order: { assessmentTime: 'DESC' },
      });
    }

    // No ManyToOne relation defined on this entity, so join to patients by raw table/condition.
    const queryBuilder = this.newbornAssessmentsRepository
      .createQueryBuilder('assessment')
      .leftJoin('patients', 'patient', 'patient.id = assessment.patientId')
      .where('assessment.organisationId = :organisationId', { organisationId })
      .andWhere('assessment.deletedAt IS NULL')
      .andWhere('patient.branch_id = :branchId', { branchId });

    if (patientId) {
      queryBuilder.andWhere('assessment.patientId = :patientId', { patientId });
    }

    return queryBuilder.orderBy('assessment.assessmentTime', 'DESC').getMany();
  }

  async createAssessment(
    organisationId: string,
    dto: CreateNewbornAssessmentDto,
    userId: string,
  ): Promise<NewbornAssessment> {
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

  async deleteAssessment(organisationId: string, id: string): Promise<{ message: string }> {
    const assessment = await this.newbornAssessmentsRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
    });
    if (!assessment) {
      throw new NotFoundException(`Newborn assessment with ID ${id} not found`);
    }
    assessment.deletedAt = new Date();
    await this.newbornAssessmentsRepository.save(assessment);
    return { message: 'Newborn assessment deleted successfully' };
  }
}
