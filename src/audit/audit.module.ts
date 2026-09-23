import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './audit.service';
import { AuditReadService } from './audit-read.service';
import { AuditController } from './audit.controller';
import { User } from '../users/entities/user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { Branch } from '../branches/entities/branch.entity';

/**
 * Shared audit infrastructure -- see
 * scope/Audit_Trail_Accountability_Scope_v4.md and
 * scope/Audit_Trail_Phase1_Auth_Implementation_Plan.md. Imported by
 * AuthModule in Phase 1; CRM and Patients import it in later phases.
 * AuditReadService/AuditController (Track A, read API + admin UI) added in
 * scope/Audit_Trail_ReadAPI_AdminUI_Implementation_Plan.md. User/
 * Organisation/Branch registered here (read-only, entity classes only --
 * no cross-module service imports) so AuditReadService.findOne() can
 * resolve actor/organisation/branch names for the detail view instead of
 * showing raw UUIDs.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, User, Organisation, Branch])],
  controllers: [AuditController],
  providers: [AuditService, AuditReadService],
  exports: [AuditService],
})
export class AuditModule {}
