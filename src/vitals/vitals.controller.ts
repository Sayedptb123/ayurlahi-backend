import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { VitalsService } from './vitals.service';
import { CreateVitalDto } from './dto/create-vital.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganisationGuard } from '../auth/guards/organisation.guard';

@ApiTags('Vitals')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, OrganisationGuard)
@Controller('organisations/:organisationId/vitals')
export class VitalsController {
  constructor(private readonly vitalsService: VitalsService) {}

  @Get()
  @ApiOperation({ summary: 'List vitals for an organisation, optionally filtered by patient' })
  @ApiQuery({ name: 'patientId', required: false, description: 'Filter by patient UUID' })
  getVitals(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.vitalsService.getVitals(organisationId, patientId);
  }

  @Post()
  @ApiOperation({ summary: 'Record a new vital measurement' })
  createVital(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @Body() dto: CreateVitalDto,
    @Request() req,
  ) {
    return this.vitalsService.createVital(
      organisationId,
      dto.patientId,
      dto,
      req.user.userId,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a vital record' })
  deleteVital(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vitalsService.deleteVital(organisationId, id);
  }
}
