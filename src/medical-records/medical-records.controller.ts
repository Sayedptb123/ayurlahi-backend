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
import { MedicalRecordsService } from './medical-records.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { GetMedicalRecordsDto } from './dto/get-medical-records.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('medical-records')
@UseGuards(JwtAuthGuard)
export class MedicalRecordsController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  @Post()
  create(@Request() req, @Body() createDto: CreateMedicalRecordDto) {
    return this.medicalRecordsService.create(
      req.user.userId,
      req.user.role,
      req.user.organisationId,
      req.user.organisationType,
      createDto,
    );
  }

  @Get()
  findAll(@Request() req, @Query() query: GetMedicalRecordsDto) {
    return this.medicalRecordsService.findAll(
      req.user.userId,
      req.user.role,
      req.user.organisationId,
      req.user.organisationType,
      query,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.medicalRecordsService.findOne(
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
    @Body() updateDto: UpdateMedicalRecordDto,
  ) {
    return this.medicalRecordsService.update(
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
    return this.medicalRecordsService.remove(
      id,
      req.user.userId,
      req.user.role,
      req.user.organisationId,
      req.user.organisationType,
    );
  }
}
