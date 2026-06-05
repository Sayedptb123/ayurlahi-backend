import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OrganisationGuard } from '../../auth/guards/organisation.guard';
import { CrmRolesGuard } from '../guards/crm-roles.guard';
import { CrmTasksService } from '../services/crm-tasks.service';
import { CreateTaskDto, UpdateTaskDto, QueryTasksDto } from '../dto/task.dto';
import { CrmActor } from '../crm-access.util';

/** Follow-up tasks & reminders (B6). */
@Controller('organisations/:organisationId/crm')
@UseGuards(JwtAuthGuard, OrganisationGuard, CrmRolesGuard)
export class CrmTasksController {
  constructor(private readonly service: CrmTasksService) {}

  private actor(req: any): CrmActor {
    return {
      userId: req.user.userId,
      role: req.user.role,
      organisationType: req.user.organisationType,
    };
  }

  @Get('tasks')
  listMine(
    @Param('organisationId') organisationId: string,
    @Query() query: QueryTasksDto,
    @Request() req: any,
  ) {
    return this.service.listMine(organisationId, this.actor(req), query);
  }

  @Get('leads/:leadId/tasks')
  listForLead(
    @Param('organisationId') organisationId: string,
    @Param('leadId') leadId: string,
    @Request() req: any,
  ) {
    return this.service.listForLead(organisationId, leadId, this.actor(req));
  }

  @Post('leads/:leadId/tasks')
  create(
    @Param('organisationId') organisationId: string,
    @Param('leadId') leadId: string,
    @Body() dto: CreateTaskDto,
    @Request() req: any,
  ) {
    return this.service.create(organisationId, leadId, dto, this.actor(req));
  }

  @Patch('tasks/:id')
  update(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @Request() req: any,
  ) {
    return this.service.update(organisationId, id, dto, this.actor(req));
  }

  @Post('tasks/:id/complete')
  complete(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.service.complete(organisationId, id, this.actor(req));
  }
}
