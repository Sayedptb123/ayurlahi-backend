import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from './guards/organization.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { StaffPosition } from '../common/enums/staff-position.enum';

@Controller('staff')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('position') position?: StaffPosition,
    @Query('isActive') isActive?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const isActiveBool =
      isActive !== undefined ? isActive === 'true' : undefined;

    return this.staffService.findAll(
      user,
      pageNum,
      limitNum,
      position,
      isActiveBool,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.staffService.findOne(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createStaffDto: CreateStaffDto,
    @CurrentUser() user: User,
  ) {
    return this.staffService.create(createStaffDto, user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateStaffDto: UpdateStaffDto,
    @CurrentUser() user: User,
  ) {
    return this.staffService.update(id, updateStaffDto, user);
  }

  @Patch(':id/status')
  async toggleStatus(@Param('id') id: string, @CurrentUser() user: User) {
    return this.staffService.toggleStatus(id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    await this.staffService.remove(id, user);
    return { message: 'Staff member deleted successfully' };
  }
}


