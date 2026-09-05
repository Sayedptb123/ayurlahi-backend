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
import { isTeamManagementTier } from '../common/utils/team-access.util';

@Controller('organisation-users')
@UseGuards(JwtAuthGuard)
export class OrganisationUsersController {
  constructor(
    private readonly organisationUsersService: OrganisationUsersService,
  ) {}

  @Post()
  create(@Body() createDto: CreateOrganisationUserDto, @Request() req) {
    return this.organisationUsersService.create(createDto, req.user);
  }

  @Get()
  findAll(@Query() query: GetOrganisationUsersDto, @Request() req) {
    return this.organisationUsersService.findAll(query, req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.organisationUsersService.findOne(id, req.user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateOrganisationUserDto,
    @Request() req,
  ) {
    return this.organisationUsersService.update(id, updateDto, req.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.organisationUsersService.remove(id, req.user);
  }

  @Patch('by-user/:userId')
  updatePermissionsByUser(
    @Param('userId') targetUserId: string,
    @Body('permissions') permissions: Record<string, boolean>,
    @Body('organisationId') bodyOrganisationId: string | undefined,
    @Request() req,
  ) {
    const isTeam = isTeamManagementTier(req.user);
    if (!isTeam && !PERMISSION_MANAGERS.includes(req.user?.role)) {
      throw new ForbiddenException('Only managers and owners can update staff permissions');
    }
    // Team-management tier may target another org (Phase 2 admin staff
    // management); everyone else is always confined to their own org,
    // regardless of what organisationId they send.
    const organisationId = isTeam && bodyOrganisationId ? bodyOrganisationId : req.user?.organisationId;
    return this.organisationUsersService.updatePermissionsByUserId(
      targetUserId,
      organisationId,
      permissions,
    );
  }

  @Patch('by-user/:userId/role')
  updateRoleByUser(
    @Param('userId') targetUserId: string,
    @Body('role') role: string,
    @Body('organisationId') bodyOrganisationId: string | undefined,
    @Request() req,
  ) {
    const isTeam = isTeamManagementTier(req.user);
    if (!isTeam && !PERMISSION_MANAGERS.includes(req.user?.role)) {
      throw new ForbiddenException('Only managers and owners can update staff roles');
    }
    const organisationId = isTeam && bodyOrganisationId ? bodyOrganisationId : req.user?.organisationId;
    return this.organisationUsersService.updateRoleByUserId(
      targetUserId,
      organisationId,
      role,
    );
  }

  @Get('user/:userId/organisations')
  getUserOrganisations(@Param('userId') userId: string, @Request() req) {
    return this.organisationUsersService.getUserOrganisations(userId, req.user);
  }

  @Get('organisation/:organisationId/users')
  getOrganisationUsers(
    @Param('organisationId') organisationId: string,
    @Request() req,
  ) {
    return this.organisationUsersService.getOrganisationUsers(organisationId, req.user);
  }
}
