import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrmLead } from './entities/crm-lead.entity';
import { CrmPipelineStage } from './entities/crm-pipeline-stage.entity';
import { CrmActivity } from './entities/crm-activity.entity';
import { CrmRequirement } from './entities/crm-requirement.entity';
import { CrmTask } from './entities/crm-task.entity';
import { CrmVisit } from './entities/crm-visit.entity';
import { CrmAuditLog } from './entities/crm-audit-log.entity';
import { CrmStaffScope } from './entities/crm-staff-scope.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { User } from '../users/entities/user.entity';
import { CrmRolesGuard } from './guards/crm-roles.guard';
import { CrmLeadsService } from './services/crm-leads.service';
import { CrmPipelineService } from './services/crm-pipeline.service';
import { CrmAuditService } from './services/crm-audit.service';
import { CrmActivitiesService } from './services/crm-activities.service';
import { CrmRequirementsService } from './services/crm-requirements.service';
import { CrmTasksService } from './services/crm-tasks.service';
import { CrmVisitsService } from './services/crm-visits.service';
import { CrmStaffService } from './services/crm-staff.service';
import { CrmLeadsController } from './controllers/crm-leads.controller';
import { CrmPipelineController } from './controllers/crm-pipeline.controller';
import { CrmActivitiesController } from './controllers/crm-activities.controller';
import { CrmRequirementsController } from './controllers/crm-requirements.controller';
import { CrmTasksController } from './controllers/crm-tasks.controller';
import { CrmVisitsController } from './controllers/crm-visits.controller';
import { CrmStaffController } from './controllers/crm-staff.controller';

/**
 * Sales CRM module — "Ayurvedic Center" pipeline for the marketing team.
 * See scope/Medilink_CRM_Final_Brief.md.
 *
 * Steps 3b–3c: leads CRUD + assignment + pipeline, activities/dispositions,
 * requirements, follow-up tasks, and geo-tagged visits — all with server-side
 * isolation and audit. The notification matrix, reports/export, and mobile UI
 * are added in later steps.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CrmLead,
      CrmPipelineStage,
      CrmActivity,
      CrmRequirement,
      CrmTask,
      CrmVisit,
      CrmAuditLog,
      CrmStaffScope,
      OrganisationUser,
      User,
    ]),
  ],
  controllers: [
    CrmLeadsController,
    CrmPipelineController,
    CrmActivitiesController,
    CrmRequirementsController,
    CrmTasksController,
    CrmVisitsController,
    CrmStaffController,
  ],
  providers: [
    CrmRolesGuard,
    CrmLeadsService,
    CrmPipelineService,
    CrmAuditService,
    CrmActivitiesService,
    CrmRequirementsService,
    CrmTasksService,
    CrmVisitsService,
    CrmStaffService,
  ],
  exports: [
    CrmRolesGuard,
    CrmLeadsService,
    CrmPipelineService,
    CrmAuditService,
    CrmActivitiesService,
    CrmRequirementsService,
    CrmTasksService,
    CrmVisitsService,
    CrmStaffService,
  ],
})
export class CrmModule {}
