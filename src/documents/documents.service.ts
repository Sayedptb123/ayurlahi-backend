import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Document } from './entities/document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { GetDocumentsDto } from './dto/get-documents.dto';
import { BranchScope, BranchScopeUser, BranchVisibilityService } from '../branch-visibility/branch-visibility.service';

// Documents attached to a patient, or to a patient's prescription / lab
// report, belong to that patient's branch (branch scoping G13 —
// scope/Branch_Scoping_Remediation_Plan_2026-09-24.md). Staff, organisation,
// expense, purchase-order and invoice documents stay organisation-wide (Q4).
const PATIENT_LINKED_TYPES = ['patient', 'prescription', 'lab_report'];

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentsRepository: Repository<Document>,
    private readonly branchVisibilityService: BranchVisibilityService,
  ) {}

  // The patient a document is about, or null when it isn't patient-linked.
  private async patientIdFor(relatedType: string, relatedId: string): Promise<string | null> {
    if (relatedType === 'patient') return relatedId;
    const table = relatedType === 'prescription' ? 'prescriptions' : relatedType === 'lab_report' ? 'lab_reports' : null;
    if (!table) return null;
    const [row] = await this.documentsRepository.query(`SELECT patient_id FROM ${table} WHERE id = $1`, [relatedId]);
    return row?.patient_id ?? null;
  }

  private async assertDocumentAccess(scope: BranchScope, organisationId: string, relatedType: string, relatedId: string, notFoundMessage: string) {
    if (!PATIENT_LINKED_TYPES.includes(relatedType)) return;
    const patientId = await this.patientIdFor(relatedType, relatedId);
    if (!patientId) throw new NotFoundException(notFoundMessage);
    await this.branchVisibilityService.assertPatientAccess(scope, organisationId, patientId)
      .catch(() => { throw new NotFoundException(notFoundMessage); });
  }

  async create(
    user: BranchScopeUser,
    organisationId: string,
    createDto: CreateDocumentDto,
    uploadedBy?: string,
  ): Promise<Document> {
    const scope = await this.branchVisibilityService.scopeForOrganisation(user, organisationId);
    await this.assertDocumentAccess(scope, organisationId, createDto.relatedType, createDto.relatedId, 'Related record not found');
    const document = this.documentsRepository.create({
      ...createDto,
      organisationId,
      uploadedBy,
      expiryDate: createDto.expiryDate ? new Date(createDto.expiryDate) : null,
    });

    return await this.documentsRepository.save(document);
  }

  async findAll(
    user: BranchScopeUser,
    organisationId: string,
    query: GetDocumentsDto,
  ): Promise<{ data: Document[]; total: number }> {
    const scope = await this.branchVisibilityService.scopeForOrganisation(user, organisationId);
    const {
      page = 1,
      limit = 10,
      search,
      relatedType,
      relatedId,
      category,
      isActive,
      isVerified,
      isExpired,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.documentsRepository
      .createQueryBuilder('document')
      .where('document.organisationId = :organisationId', { organisationId })
      .andWhere('document.deletedAt IS NULL');

    // Restricted users: patient-linked documents only for patients in scope.
    if (scope.kind === 'branches') {
      const inScope = scope.ids.length
        // Raw column names: TypeORM doesn't rewrite alias.property inside CASE.
        ? `OR EXISTS (
            SELECT 1 FROM patients p
             WHERE p.id = CASE "document"."related_type"
                            WHEN 'patient' THEN "document"."related_id"
                            WHEN 'prescription' THEN (SELECT rx.patient_id FROM prescriptions rx WHERE rx.id = "document"."related_id")
                            WHEN 'lab_report' THEN (SELECT lr.patient_id FROM lab_reports lr WHERE lr.id = "document"."related_id")
                          END
               AND p.branch_id IN (:...docScopeIds))`
        : '';
      queryBuilder.andWhere(
        `(document.relatedType NOT IN (:...patientLinkedTypes) ${inScope})`,
        { patientLinkedTypes: PATIENT_LINKED_TYPES, docScopeIds: scope.ids },
      );
    }

    if (search) {
      queryBuilder.andWhere(
        '(document.name ILIKE :search OR document.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (relatedType) {
      queryBuilder.andWhere('document.relatedType = :relatedType', {
        relatedType,
      });
    }

    if (relatedId) {
      queryBuilder.andWhere('document.relatedId = :relatedId', { relatedId });
    }

    if (category) {
      queryBuilder.andWhere('document.category = :category', { category });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('document.isActive = :isActive', { isActive });
    }

    if (isVerified !== undefined) {
      queryBuilder.andWhere('document.isVerified = :isVerified', {
        isVerified,
      });
    }

    if (isExpired !== undefined) {
      queryBuilder.andWhere('document.isExpired = :isExpired', { isExpired });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('document.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total };
  }

  async findOne(user: BranchScopeUser, id: string, organisationId: string): Promise<Document> {
    const scope = await this.branchVisibilityService.scopeForOrganisation(user, organisationId);
    const document = await this.documentsRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
      relations: ['uploader', 'verifier'],
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }
    await this.assertDocumentAccess(scope, organisationId, document.relatedType, document.relatedId, `Document with ID ${id} not found`);

    return document;
  }

  async update(
    user: BranchScopeUser,
    id: string,
    organisationId: string,
    updateDto: UpdateDocumentDto,
    verifiedBy?: string,
  ): Promise<Document> {
    // relatedType/relatedId aren't updatable (UpdateDocumentDto), so the
    // access check in findOne covers the edit.
    const document = await this.findOne(user, id, organisationId);

    // If verifying, set verified fields
    if (updateDto.isVerified && !document.isVerified && verifiedBy) {
      updateDto['verifiedBy'] = verifiedBy;
      updateDto['verifiedAt'] = new Date();
    }

    if (updateDto.expiryDate) {
      document.expiryDate = new Date(updateDto.expiryDate);
    }

    Object.assign(document, updateDto);
    return await this.documentsRepository.save(document);
  }

  async remove(user: BranchScopeUser, id: string, organisationId: string): Promise<void> {
    const document = await this.findOne(user, id, organisationId);
    await this.documentsRepository.softDelete(document.id);
  }

  async getByRelated(
    user: BranchScopeUser,
    organisationId: string,
    relatedType: string,
    relatedId: string,
  ): Promise<Document[]> {
    const scope = await this.branchVisibilityService.scopeForOrganisation(user, organisationId);
    await this.assertDocumentAccess(scope, organisationId, relatedType, relatedId, 'Related record not found');
    return await this.documentsRepository.find({
      where: {
        organisationId,
        relatedType: relatedType as any,
        relatedId,
        deletedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async verifyDocument(
    user: BranchScopeUser,
    id: string,
    organisationId: string,
    verifiedBy: string,
  ): Promise<Document> {
    const document = await this.findOne(user, id, organisationId);
    document.isVerified = true;
    document.verifiedBy = verifiedBy;
    document.verifiedAt = new Date();
    return await this.documentsRepository.save(document);
  }

  async checkExpiredDocuments(organisationId?: string): Promise<number> {
    const queryBuilder = this.documentsRepository
      .createQueryBuilder('document')
      .where('document.expiryDate < CURRENT_DATE')
      .andWhere('document.isExpired = false')
      .andWhere('document.deletedAt IS NULL');

    if (organisationId) {
      queryBuilder.andWhere('document.organisationId = :organisationId', {
        organisationId,
      });
    }

    const expired = await queryBuilder.getMany();
    const count = expired.length;

    if (count > 0) {
      await this.documentsRepository.update(
        { id: expired.map((d) => d.id) as any },
        { isExpired: true },
      );
    }

    return count;
  }
}
