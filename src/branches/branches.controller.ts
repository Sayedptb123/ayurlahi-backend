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
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { GetBranchesDto } from './dto/get-branches.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganisationGuard } from '../auth/guards/organisation.guard';

@Controller('organisations/:organisationId/branches')
@UseGuards(JwtAuthGuard, OrganisationGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  create(
    @Param('organisationId') organisationId: string,
    @Body() createDto: CreateBranchDto,
    @Request() req,
  ) {
    return this.branchesService.create(
      organisationId,
      createDto,
      req.user?.userId,
    );
  }

  @Get()
  findAll(
    @Param('organisationId') organisationId: string,
    @Query() query: GetBranchesDto,
  ) {
    return this.branchesService.findAll(organisationId, query);
  }

  @Get('primary')
  getPrimaryBranch(@Param('organisationId') organisationId: string) {
    return this.branchesService.getPrimaryBranch(organisationId);
  }

  @Get(':id')
  findOne(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.branchesService.findOne(id, organisationId);
  }

  @Patch(':id')
  update(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateBranchDto,
  ) {
    return this.branchesService.update(id, organisationId, updateDto);
  }

  @Delete(':id')
  remove(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.branchesService.remove(id, organisationId);
  }
}


