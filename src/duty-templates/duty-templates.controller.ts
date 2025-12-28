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
  constructor(private readonly templatesService: DutyTemplatesService) {}

  @Post()
  create(
    @Param('organisationId') organisationId: string,
    @Body() createDto: CreateDutyTemplateDto,
    @Request() req,
  ) {
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
  update(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateDutyTemplateDto,
  ) {
    return this.templatesService.update(id, organisationId, updateDto);
  }

  @Delete(':id')
  remove(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.templatesService.remove(id, organisationId);
  }

  @Post(':id/apply')
  applyTemplate(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() applyDto: ApplyTemplateDto,
    @Request() req,
  ) {
    return this.templatesService.applyTemplate(
      id,
      organisationId,
      applyDto,
      req.user?.userId,
    );
  }
}

