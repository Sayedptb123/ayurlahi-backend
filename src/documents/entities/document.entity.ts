import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { User } from '../../users/entities/user.entity';

export type DocumentRelatedType =
  | 'staff'
  | 'patient'
  | 'organisation'
  | 'expense'
  | 'purchase_order'
  | 'invoice'
  | 'prescription'
  | 'lab_report'
  | 'other';

export type DocumentCategory =
  | 'cv'
  | 'biodata'
  | 'license'
  | 'certificate'
  | 'invoice'
  | 'receipt'
  | 'prescription'
  | 'lab_report'
  | 'medical_record'
  | 'identity'
  | 'other';

export type AccessLevel = 'public' | 'internal' | 'private';

@Entity('documents')
@Index(['organisationId', 'deletedAt'])
@Index(['relatedType', 'relatedId', 'deletedAt'])
@Index(['category', 'deletedAt'])
@Index(['expiryDate'], { where: 'isExpired = false AND deletedAt IS NULL' })
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ type: 'varchar', length: 50, name: 'related_type' })
  relatedType: DocumentRelatedType;

  @Column({ type: 'uuid', name: 'related_id' })
  relatedId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, name: 'file_name' })
  fileName: string;

  @Column({ type: 'text', name: 'file_path' })
  filePath: string;

  @Column({ type: 'text', nullable: true, name: 'file_url' })
  fileUrl: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'file_type' })
  fileType: string | null;

  @Column({ type: 'bigint', nullable: true, name: 'file_size' })
  fileSize: number | null;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
    name: 'file_extension',
  })
  fileExtension: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category: DocumentCategory | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  subcategory: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'boolean', default: false, name: 'is_public' })
  isPublic: boolean;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'private',
    name: 'access_level',
  })
  accessLevel: AccessLevel;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_verified' })
  isVerified: boolean;

  @Column({ type: 'uuid', nullable: true, name: 'verified_by' })
  verifiedBy: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'verified_by' })
  verifier: User | null;

  @Column({ type: 'timestamp', nullable: true, name: 'verified_at' })
  verifiedAt: Date | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'uuid', nullable: true, name: 'parent_document_id' })
  parentDocumentId: string | null;

  @ManyToOne(() => Document)
  @JoinColumn({ name: 'parent_document_id' })
  parentDocument: Document | null;

  @Column({ type: 'date', nullable: true, name: 'expiry_date' })
  expiryDate: Date | null;

  @Column({ type: 'boolean', default: false, name: 'is_expired' })
  isExpired: boolean;

  @Column({ type: 'uuid', nullable: true, name: 'uploaded_by' })
  uploadedBy: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by' })
  uploader: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}


