import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TreatmentProtocolsService } from './treatment-protocols.service';
import { CreateTreatmentProtocolDto } from './dto/create-treatment-protocol.dto';

@Controller('organisations/:organisationId/treatment-protocols')
@UseGuards(JwtAuthGuard)
export class TreatmentProtocolsController {
  constructor(private readonly service: TreatmentProtocolsService) {}

  @Post()
  create(
    @Param('organisationId') organisationId: string,
    @Body() dto: CreateTreatmentProtocolDto,
  ) {
    return this.service.create(organisationId, dto);
  }

  @Get()
  findAll(@Param('organisationId') organisationId: string) {
    return this.service.findAll(organisationId);
  }

  @Get(':id')
  findOne(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(organisationId, id);
  }

  @Delete(':id')
  remove(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(organisationId, id);
  }
}
