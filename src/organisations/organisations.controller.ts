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
import { OrganisationsService } from './organisations.service';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { GetOrganisationsDto } from './dto/get-organisations.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('organisations')
@UseGuards(JwtAuthGuard)
export class OrganisationsController {
  constructor(private readonly organisationsService: OrganisationsService) {}

  @Post()
  create(@Body() createDto: CreateOrganisationDto, @Request() req) {
    return this.organisationsService.create(createDto, req.user?.userId);
  }

  @Get()
  findAll(@Query() query: GetOrganisationsDto) {
    return this.organisationsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.organisationsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateOrganisationDto) {
    return this.organisationsService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.organisationsService.remove(id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Request() req) {
    return this.organisationsService.approve(id, req.user?.userId);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body('rejectionReason') rejectionReason: string,
    @Request() req,
  ) {
    return this.organisationsService.reject(
      id,
      rejectionReason,
      req.user?.userId,
    );
  }
}
