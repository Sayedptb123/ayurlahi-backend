import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganisationGuard } from '../auth/guards/organisation.guard';

@Controller('organisations/:organisationId/tasks')
@UseGuards(JwtAuthGuard, OrganisationGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(
    @Param('organisationId') organisationId: string,
    @Body() createDto: CreateTaskDto,
    @Request() req,
  ) {
    return this.tasksService.create(organisationId, createDto, req.user?.userId);
  }

  @Get()
  findAll(
    @Param('organisationId') organisationId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('assignedToStaffId') assignedToStaffId?: string,
    @Query('assignedToUserId') assignedToUserId?: string,
    @Query('assignedBy') assignedBy?: string,
  ) {
    return this.tasksService.findAll(organisationId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status,
      assignedToStaffId,
      assignedToUserId,
      assignedBy,
    });
  }

  @Get(':id')
  findOne(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.tasksService.findOne(id, organisationId);
  }

  @Patch(':id')
  update(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, organisationId, updateDto);
  }

  @Delete(':id')
  remove(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.tasksService.remove(id, organisationId);
  }
}
