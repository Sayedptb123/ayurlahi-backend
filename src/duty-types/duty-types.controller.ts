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
import { DutyTypesService } from './duty-types.service';
import { CreateDutyTypeDto } from './dto/create-duty-type.dto';
import { UpdateDutyTypeDto } from './dto/update-duty-type.dto';
import { GetDutyTypesDto } from './dto/get-duty-types.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganisationGuard } from '../auth/guards/organisation.guard';

@Controller('organisations/:organisationId/duty-types')
@UseGuards(JwtAuthGuard, OrganisationGuard)
export class DutyTypesController {
  constructor(private readonly dutyTypesService: DutyTypesService) {}

  @Post()
  create(
    @Param('organisationId') organisationId: string,
    @Body() createDto: CreateDutyTypeDto,
    @Request() req,
  ) {
    return this.dutyTypesService.create(
      organisationId,
      createDto,
      req.user?.userId,
    );
  }

  @Get()
  findAll(
    @Param('organisationId') organisationId: string,
    @Query() query: GetDutyTypesDto,
  ) {
    return this.dutyTypesService.findAll(organisationId, query);
  }

  @Get(':id')
  findOne(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.dutyTypesService.findOne(id, organisationId);
  }

  @Patch(':id')
  update(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateDutyTypeDto,
  ) {
    return this.dutyTypesService.update(id, organisationId, updateDto);
  }

  @Delete(':id')
  remove(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.dutyTypesService.remove(id, organisationId);
  }
}


