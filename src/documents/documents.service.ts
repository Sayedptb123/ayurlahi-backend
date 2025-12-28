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

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentsRepository: Repository<Document>,
  ) {}

  async create(
    organisationId: string,
    createDto: CreateDocumentDto,
    uploadedBy?: string,
  ): Promise<Document> {
    const document = this.documentsRepository.create({
      ...createDto,
      organisationId,
      uploadedBy,
      expiryDate: createDto.expiryDate ? new Date(createDto.expiryDate) : null,
    });

    return await this.documentsRepository.save(document);
  }

  async findAll(
    organisationId: string,
    query: GetDocumentsDto,
  ): Promise<{ data: Document[]; total: number }> {
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

  async findOne(id: string, organisationId: string): Promise<Document> {
    const document = await this.documentsRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
      relations: ['uploader', 'verifier'],
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    return document;
  }

  async update(
    id: string,
    organisationId: string,
    updateDto: UpdateDocumentDto,
    verifiedBy?: string,
  ): Promise<Document> {
    const document = await this.findOne(id, organisationId);

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

  async remove(id: string, organisationId: string): Promise<void> {
    const document = await this.findOne(id, organisationId);
    await this.documentsRepository.softDelete(document.id);
  }

  async getByRelated(
    organisationId: string,
    relatedType: string,
    relatedId: string,
  ): Promise<Document[]> {
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
    id: string,
    organisationId: string,
    verifiedBy: string,
  ): Promise<Document> {
    const document = await this.findOne(id, organisationId);
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
