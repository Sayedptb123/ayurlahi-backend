import { BranchVisibilityService } from '../branch-visibility/branch-visibility.service';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
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
  constructor(
    private readonly assignmentsService: DutyAssignmentsService,
    private readonly branchVisibility: BranchVisibilityService,
  ) {}

  // Branch scoping G10 (scope/Branch_Scoping_Remediation_Plan_2026-09-24.md):
  // creates resolve the branch through the shared rule; edits / deletes first
  // check the existing row's branch is in the caller's scope (404), and a
  // branch move goes through the same write rule.
  private scopeOf(req: any, organisationId: string) {
    return this.branchVisibility.scopeForOrganisation(req.user, organisationId);
  }

  private async gateRow(req: any, organisationId: string, id: string, requestedBranchId?: string | null) {
    const scope = await this.scopeOf(req, organisationId);
    const row: any = await this.assignmentsService.findOne(id, organisationId);
    this.branchVisibility.assertBranchAccess(scope, row.branchId, 'Duty assignment not found');
    return requestedBranchId ? this.branchVisibility.resolveWriteBranch(scope, organisationId, { requested: requestedBranchId }) : undefined;
  }

  @Post()
  async create(
    @Param('organisationId') organisationId: string,
    @Body() createDto: CreateDutyAssignmentDto,
    @Request() req,
  ) {
    createDto.branchId = (await this.branchVisibility.resolveWriteBranch(await this.scopeOf(req, organisationId), organisationId, { requested: createDto.branchId })) as any;
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
  async update(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateDutyAssignmentDto,
    @Request() req,
  ) {
    await this.gateRow(req, organisationId, id); // branch isn't editable on an assignment
    return this.assignmentsService.update(id, organisationId, updateDto);
  }

  @Put(':id')
  async updatePut(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateDutyAssignmentDto,
    @Request() req,
  ) {
    await this.gateRow(req, organisationId, id); // branch isn't editable on an assignment
    return this.assignmentsService.update(id, organisationId, updateDto);
  }

  @Delete(':id')
  async remove(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Request() req,
  ) {
    await this.gateRow(req, organisationId, id);
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


