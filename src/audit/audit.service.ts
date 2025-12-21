import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditAction } from '../common/enums/audit-action.enum';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogsRepository: Repository<AuditLog>,
  ) {}

  async log(
    userId: string | null,
    entityType: string,
    entityId: string | null,
    action: AuditAction,
    description: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog> {
    const auditLog = this.auditLogsRepository.create({
      userId: userId || undefined,
      entityType,
      entityId: entityId || undefined,
      action,
      description,
      oldValues,
      newValues,
      metadata,
      ipAddress,
      userAgent,
    });

    return this.auditLogsRepository.save(auditLog);
  }

  async findByEntity(
    entityType: string,
    entityId: string,
  ): Promise<AuditLog[]> {
    return this.auditLogsRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByUser(userId: string): Promise<AuditLog[]> {
    return this.auditLogsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}

