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
import { NewbornAssessmentsService } from './newborn-assessments.service';
import { CreateNewbornAssessmentDto } from './dto/create-newborn-assessment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganisationGuard } from '../auth/guards/organisation.guard';

@ApiTags('Newborn Assessments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, OrganisationGuard)
@Controller('organisations/:organisationId/newborn-assessments')
export class NewbornAssessmentsController {
  constructor(private readonly newbornAssessmentsService: NewbornAssessmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List newborn assessments for an organisation, optionally filtered by baby patient' })
  @ApiQuery({ name: 'patientId', required: false, description: 'Filter by baby patient UUID' })
  getAssessments(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.newbornAssessmentsService.getAssessments(organisationId, patientId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new newborn assessment' })
  createAssessment(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @Body() dto: CreateNewbornAssessmentDto,
    @Request() req,
  ) {
    return this.newbornAssessmentsService.createAssessment(
      organisationId,
      dto,
      req.user.userId,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a newborn assessment' })
  deleteAssessment(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.newbornAssessmentsService.deleteAssessment(organisationId, id);
  }
}
