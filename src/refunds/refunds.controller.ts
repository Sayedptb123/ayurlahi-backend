import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

@Controller('refunds')
@UseGuards(JwtAuthGuard)
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post('order/:orderId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLINIC, UserRole.ADMIN, UserRole.SUPPORT)
  async create(
    @Param('orderId') orderId: string,
    @Body() createRefundDto: CreateRefundDto,
    @CurrentUser() user: User,
  ) {
    return this.refundsService.create(
      orderId,
      createRefundDto.reason,
      createRefundDto.amount,
      createRefundDto.notes,
      user.id,
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  async findAll() {
    return this.refundsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.refundsService.findOne(id);
  }

  @Get('order/:orderId')
  async findByOrderId(@Param('orderId') orderId: string) {
    return this.refundsService.findByOrderId(orderId);
  }
}


