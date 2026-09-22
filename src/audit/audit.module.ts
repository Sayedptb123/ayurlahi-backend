import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './audit.service';

/**
 * Shared audit infrastructure -- see
 * scope/Audit_Trail_Accountability_Scope_v4.md and
 * scope/Audit_Trail_Phase1_Auth_Implementation_Plan.md. Imported by
 * AuthModule in Phase 1; CRM and Patients import it in later phases.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
