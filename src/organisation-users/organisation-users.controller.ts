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
import { OrganisationUsersService } from './organisation-users.service';
import { CreateOrganisationUserDto } from './dto/create-organisation-user.dto';
import { UpdateOrganisationUserDto } from './dto/update-organisation-user.dto';

const PERMISSION_MANAGERS = ['OWNER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'];
import { GetOrganisationUsersDto } from './dto/get-organisation-users.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('organisation-users')
@UseGuards(JwtAuthGuard)
export class OrganisationUsersController {
  constructor(
    private readonly organisationUsersService: OrganisationUsersService,
  ) {}

  @Post()
  create(@Body() createDto: CreateOrganisationUserDto, @Request() req) {
    return this.organisationUsersService.create(createDto, req.user?.userId);
  }

  @Get()
  findAll(@Query() query: GetOrganisationUsersDto) {
    return this.organisationUsersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.organisationUsersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateOrganisationUserDto,
  ) {
    return this.organisationUsersService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.organisationUsersService.remove(id);
  }

  @Patch('by-user/:userId')
  updatePermissionsByUser(
    @Param('userId') targetUserId: string,
    @Body('permissions') permissions: Record<string, boolean>,
    @Request() req,
  ) {
    if (!PERMISSION_MANAGERS.includes(req.user?.role)) {
      throw new ForbiddenException('Only managers and owners can update staff permissions');
    }
    const organisationId = req.user?.organisationId;
    return this.organisationUsersService.updatePermissionsByUserId(
      targetUserId,
      organisationId,
      permissions,
    );
  }

  @Get('user/:userId/organisations')
  getUserOrganisations(@Param('userId') userId: string) {
    return this.organisationUsersService.getUserOrganisations(userId);
  }

  @Get('organisation/:organisationId/users')
  getOrganisationUsers(@Param('organisationId') organisationId: string) {
    return this.organisationUsersService.getOrganisationUsers(organisationId);
  }
}
