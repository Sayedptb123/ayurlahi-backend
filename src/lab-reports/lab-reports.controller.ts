import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { LabReportsService } from './lab-reports.service';
import { CreateLabReportDto } from './dto/create-lab-report.dto';
import { UpdateLabReportDto } from './dto/update-lab-report.dto';
import { GetLabReportsDto } from './dto/get-lab-reports.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('lab-reports')
@UseGuards(JwtAuthGuard)
export class LabReportsController {
  constructor(private readonly labReportsService: LabReportsService) {}

  @Post()
  create(@Request() req, @Body() createDto: CreateLabReportDto) {
    return this.labReportsService.create(
      req.user.userId,
      req.user.role,
      req.user.organisationId,
      req.user.organisationType,
      createDto,
    );
  }

  @Get()
  findAll(@Request() req, @Query() query: GetLabReportsDto) {
    return this.labReportsService.findAll(
      req.user.userId,
      req.user.role,
      req.user.organisationId,
      req.user.organisationType,
      query,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.labReportsService.findOne(
      id,
      req.user.userId,
      req.user.role,
      req.user.organisationId,
      req.user.organisationType,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() updateDto: UpdateLabReportDto,
  ) {
    return this.labReportsService.update(
      id,
      req.user.userId,
      req.user.role,
      req.user.organisationId,
      req.user.organisationType,
      updateDto,
    );
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.labReportsService.remove(
      id,
      req.user.userId,
      req.user.role,
      req.user.organisationId,
      req.user.organisationType,
    );
  }
}
