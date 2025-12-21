import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { DisputeStatus } from '../common/enums/dispute-status.enum';
import { ClinicsService } from '../clinics/clinics.service';

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(
    private readonly disputesService: DisputesService,
    private readonly clinicsService: ClinicsService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLINIC)
  async create(
    @Body() createDisputeDto: CreateDisputeDto,
    @CurrentUser() user: User,
  ) {
    const clinic = await this.clinicsService.findByUserId(user.id);
    return this.disputesService.create(
      createDisputeDto.orderId,
      clinic.id,
      createDisputeDto.type,
      createDisputeDto.description,
      createDisputeDto.evidence,
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  findAll(
    @Query('status') status?: DisputeStatus,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.disputesService.findAll(status, limitNum);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.disputesService.findOne(id);
  }

  @Post(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  resolve(
    @Param('id') id: string,
    @Body() resolveDto: ResolveDisputeDto,
    @CurrentUser() user: User,
  ) {
    return this.disputesService.resolve(id, resolveDto.resolution, user.id);
  }

  @Post(':id/comments')
  async addComment(
    @Param('id') id: string,
    @Body() addCommentDto: AddCommentDto,
    @CurrentUser() user: User,
  ) {
    return this.disputesService.addComment(
      id,
      user.id,
      `${user.firstName} ${user.lastName}`,
      addCommentDto.comment,
    );
  }
}

