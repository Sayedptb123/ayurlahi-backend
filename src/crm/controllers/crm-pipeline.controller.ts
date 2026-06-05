import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OrganisationGuard } from '../../auth/guards/organisation.guard';
import { CrmRolesGuard } from '../guards/crm-roles.guard';
import { CrmRoles } from '../decorators/crm-roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { CrmPipelineService } from '../services/crm-pipeline.service';
import { CreateStageDto, UpdateStageDto } from '../dto/stage.dto';

/**
 * Configurable pipeline stages (B2). Anyone on the team can read the stages
 * (the board needs them); only Owner/Admin may configure them.
 */
@Controller('organisations/:organisationId/crm/stages')
@UseGuards(JwtAuthGuard, OrganisationGuard, CrmRolesGuard)
export class CrmPipelineController {
  constructor(private readonly pipeline: CrmPipelineService) {}

  @Get()
  list(@Param('organisationId') organisationId: string) {
    return this.pipeline.listStages(organisationId);
  }

  @Post()
  @CrmRoles(UserRole.OWNER, UserRole.ADMIN)
  create(
    @Param('organisationId') organisationId: string,
    @Body() dto: CreateStageDto,
  ) {
    return this.pipeline.createStage(organisationId, dto);
  }

  @Patch(':id')
  @CrmRoles(UserRole.OWNER, UserRole.ADMIN)
  update(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.pipeline.updateStage(organisationId, id, dto);
  }
}
