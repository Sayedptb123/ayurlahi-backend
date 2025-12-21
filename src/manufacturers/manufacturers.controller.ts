import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ManufacturersService } from './manufacturers.service';
import { CreateManufacturerDto } from './dto/create-manufacturer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

@Controller('manufacturers')
@UseGuards(JwtAuthGuard)
export class ManufacturersController {
  constructor(private readonly manufacturersService: ManufacturersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANUFACTURER)
  async create(
    @Body() createManufacturerDto: CreateManufacturerDto,
    @CurrentUser() user: User,
  ) {
    return this.manufacturersService.create(user.id, createManufacturerDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  findAll() {
    return this.manufacturersService.findAll();
  }

  @Get('me')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANUFACTURER)
  findMyManufacturer(@CurrentUser() user: User) {
    return this.manufacturersService.findByUserId(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.manufacturersService.findOne(id);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  approve(@Param('id') id: string, @CurrentUser() user: User) {
    return this.manufacturersService.approve(id, user.id);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  reject(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: User,
  ) {
    return this.manufacturersService.reject(id, body.reason, user.id);
  }
}





