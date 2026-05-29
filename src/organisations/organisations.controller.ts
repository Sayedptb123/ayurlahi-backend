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
  ForbiddenException,
} from '@nestjs/common';
import { OrganisationsService } from './organisations.service';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { GetOrganisationsDto } from './dto/get-organisations.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

function requireTeam(req: any) {
  if (req.user?.organisationType !== 'AYURLAHI_TEAM') {
    throw new ForbiddenException('Only Ayurlahi Team members can perform this action');
  }
}

@Controller('organisations')
@UseGuards(JwtAuthGuard)
export class OrganisationsController {
  constructor(private readonly organisationsService: OrganisationsService) {}

  @Post()
  create(@Body() createDto: CreateOrganisationDto, @Request() req) {
    return this.organisationsService.create(createDto, req.user?.userId, req.user?.organisationType);
  }

  @Get()
  findAll(@Query() query: GetOrganisationsDto, @Request() req) {
    requireTeam(req);
    return this.organisationsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    const isTeam = req.user?.organisationType === 'AYURLAHI_TEAM';
    const isOwnOrg = req.user?.organisationId === id;
    if (!isTeam && !isOwnOrg) {
      throw new ForbiddenException('You can only view your own organisation');
    }
    return this.organisationsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateOrganisationDto, @Request() req) {
    requireTeam(req);
    return this.organisationsService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    requireTeam(req);
    return this.organisationsService.remove(id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Request() req) {
    requireTeam(req);
    return this.organisationsService.approve(id, req.user?.userId);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body('rejectionReason') rejectionReason: string,
    @Request() req,
  ) {
    requireTeam(req);
    return this.organisationsService.reject(id, rejectionReason, req.user?.userId);
  }

  @Get(':id/capabilities')
  getCapabilities(@Param('id') id: string, @Request() req) {
    const isTeam = req.user?.organisationType === 'AYURLAHI_TEAM';
    const isOwnOrg = req.user?.organisationId === id;
    if (!isTeam && !isOwnOrg) {
      throw new ForbiddenException('You can only view your own organisation capabilities');
    }
    return this.organisationsService.getCapabilities(id);
  }

  @Patch(':id/capabilities')
  updateCapabilities(@Param('id') id: string, @Body() body: any, @Request() req) {
    const isOwnOrg = req.user?.organisationId === id;
    const isOwnerOrManager = ['OWNER', 'MANAGER'].includes(req.user?.role);
    if (!isOwnOrg || !isOwnerOrManager) {
      throw new ForbiddenException('Only the clinic OWNER or MANAGER can update service capabilities');
    }
    return this.organisationsService.updateCapabilities(id, body);
  }
}
