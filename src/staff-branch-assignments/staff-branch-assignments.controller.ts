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
import { StaffBranchAssignmentsService } from './staff-branch-assignments.service';
import { CreateStaffBranchAssignmentDto } from './dto/create-staff-branch-assignment.dto';
import { UpdateStaffBranchAssignmentDto } from './dto/update-staff-branch-assignment.dto';
import { GetStaffBranchAssignmentsDto } from './dto/get-staff-branch-assignments.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganisationGuard } from '../auth/guards/organisation.guard';

@Controller('organisations/:organisationId/staff-branch-assignments')
@UseGuards(JwtAuthGuard, OrganisationGuard)
export class StaffBranchAssignmentsController {
  constructor(
    private readonly assignmentsService: StaffBranchAssignmentsService,
  ) {}

  @Post()
  create(
    @Param('organisationId') organisationId: string,
    @Body() createDto: CreateStaffBranchAssignmentDto,
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
    @Query() query: GetStaffBranchAssignmentsDto,
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
    @Body() updateDto: UpdateStaffBranchAssignmentDto,
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

  @Get('staff/:staffId/branches')
  getStaffBranches(
    @Param('organisationId') organisationId: string,
    @Param('staffId') staffId: string,
  ) {
    return this.assignmentsService.getStaffBranches(staffId, organisationId);
  }

  @Get('branch/:branchId/staff')
  getBranchStaff(
    @Param('organisationId') organisationId: string,
    @Param('branchId') branchId: string,
  ) {
    return this.assignmentsService.getBranchStaff(branchId, organisationId);
  }
}


