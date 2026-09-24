import { BranchVisibilityService } from '../branch-visibility/branch-visibility.service';
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
import { DutyTemplatesService } from './duty-templates.service';
import { CreateDutyTemplateDto } from './dto/create-duty-template.dto';
import { UpdateDutyTemplateDto } from './dto/update-duty-template.dto';
import { GetDutyTemplatesDto } from './dto/get-duty-templates.dto';
import { ApplyTemplateDto } from './dto/apply-template.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganisationGuard } from '../auth/guards/organisation.guard';

@Controller('organisations/:organisationId/duty-templates')
@UseGuards(JwtAuthGuard, OrganisationGuard)
export class DutyTemplatesController {
  constructor(
    private readonly templatesService: DutyTemplatesService,
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
    const row: any = await this.templatesService.findOne(id, organisationId);
    this.branchVisibility.assertBranchAccess(scope, row.branchId, 'Duty template not found');
    return requestedBranchId ? this.branchVisibility.resolveWriteBranch(scope, organisationId, { requested: requestedBranchId }) : undefined;
  }

  @Post()
  async create(
    @Param('organisationId') organisationId: string,
    @Body() createDto: CreateDutyTemplateDto,
    @Request() req,
  ) {
    createDto.branchId = (await this.branchVisibility.resolveWriteBranch(await this.scopeOf(req, organisationId), organisationId, { requested: createDto.branchId })) as any;
    return this.templatesService.create(
      organisationId,
      createDto,
      req.user?.userId,
    );
  }

  @Get()
  findAll(
    @Param('organisationId') organisationId: string,
    @Query() query: GetDutyTemplatesDto,
  ) {
    return this.templatesService.findAll(organisationId, query);
  }

  @Get(':id')
  findOne(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.templatesService.findOne(id, organisationId);
  }

  @Patch(':id')
  async update(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateDutyTemplateDto,
    @Request() req,
  ) {
    const movedTo = await this.gateRow(req, organisationId, id, updateDto.branchId);
    if (movedTo !== undefined) updateDto.branchId = movedTo as any;
    return this.templatesService.update(id, organisationId, updateDto);
  }

  @Delete(':id')
  async remove(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Request() req,
  ) {
    await this.gateRow(req, organisationId, id);
    return this.templatesService.remove(id, organisationId);
  }

  @Post(':id/apply')
  async applyTemplate(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() applyDto: ApplyTemplateDto,
    @Request() req,
  ) {
    await this.gateRow(req, organisationId, id);
    return this.templatesService.applyTemplate(
      id,
      organisationId,
      applyDto,
      req.user?.userId,
    );
  }
}


