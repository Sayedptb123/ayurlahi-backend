import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PayoutsService } from './payouts.service';
import { GetPayoutsDto } from './dto/get-payouts.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('payouts')
@ApiBearerAuth('access-token')
@Controller('payouts')
@UseGuards(JwtAuthGuard)
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get()
  async findAll(@Request() req, @Query() query: GetPayoutsDto) {
    return this.payoutsService.findAll(req.user.organisationId, req.user.role, query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.payoutsService.findOne(id, req.user.organisationId, req.user.role);
  }
}
