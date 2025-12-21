import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

@Controller('clinics')
@UseGuards(JwtAuthGuard)
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLINIC)
  async create(
    @Body() createClinicDto: CreateClinicDto,
    @CurrentUser() user: User,
  ) {
    return this.clinicsService.create(user.id, createClinicDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  findAll() {
    return this.clinicsService.findAll();
  }

  @Get('me')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLINIC)
  findMyClinic(@CurrentUser() user: User) {
    return this.clinicsService.findByUserId(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clinicsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLINIC, UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateClinicDto: UpdateClinicDto,
    @CurrentUser() user: User,
  ) {
    // Only allow clinic to update their own profile, or admin
    if (user.role !== UserRole.ADMIN) {
      // Verify ownership
      return this.clinicsService.findByUserId(user.id).then((clinic) => {
        if (clinic.id !== id) {
          throw new Error('Unauthorized');
        }
        return this.clinicsService.update(id, updateClinicDto);
      });
    }
    return this.clinicsService.update(id, updateClinicDto);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  approve(@Param('id') id: string, @CurrentUser() user: User) {
    return this.clinicsService.approve(id, user.id);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  reject(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: User,
  ) {
    return this.clinicsService.reject(id, body.reason, user.id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.clinicsService.remove(id);
  }
}





