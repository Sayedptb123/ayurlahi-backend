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
import { DutyAssignmentsService } from './duty-assignments.service';
import { CreateDutyAssignmentDto } from './dto/create-duty-assignment.dto';
import { UpdateDutyAssignmentDto } from './dto/update-duty-assignment.dto';
import { GetDutyAssignmentsDto } from './dto/get-duty-assignments.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganisationGuard } from '../auth/guards/organisation.guard';

@Controller('organisations/:organisationId/duty-assignments')
@UseGuards(JwtAuthGuard, OrganisationGuard)
export class DutyAssignmentsController {
  constructor(private readonly assignmentsService: DutyAssignmentsService) {}

  @Post()
  create(
    @Param('organisationId') organisationId: string,
    @Body() createDto: CreateDutyAssignmentDto,
    @Request() req,
  ) {
    return this.assignmentsService.create(
      organisationId,
      createDto,
      req.user?.userId,
    );
  }

  @Get()
  findAll(
    @Param('organisationId') organisationId: string,
    @Query() query: GetDutyAssignmentsDto,
  ) {
    return this.assignmentsService.findAll(organisationId, query);
  }

  @Get(':id')
  findOne(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.assignmentsService.findOne(id, organisationId);
  }

  @Patch(':id')
  update(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateDutyAssignmentDto,
  ) {
    return this.assignmentsService.update(id, organisationId, updateDto);
  }

  @Delete(':id')
  remove(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.assignmentsService.remove(id, organisationId);
  }

  @Post(':id/check-in')
  checkIn(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() checkInDto: CheckInDto,
  ) {
    return this.assignmentsService.checkIn(id, organisationId, checkInDto);
  }

  @Post(':id/check-out')
  checkOut(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() checkOutDto: CheckOutDto,
  ) {
    return this.assignmentsService.checkOut(id, organisationId, checkOutDto);
  }
}


