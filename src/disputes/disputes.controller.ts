import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { GetDisputesDto } from './dto/get-disputes.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  async findAll(@Request() req, @Query() query: GetDisputesDto) {
    try {
      return await this.disputesService.findAll(
        req.user.userId,
        req.user.role,
        query,
      );
    } catch (error) {
      console.error('[Disputes Controller] Error in findAll:', {
        error: error.message,
        stack: error.stack,
        userRole: req.user?.role,
        userId: req.user?.userId,
        query,
      });
      throw error;
    }
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.disputesService.findOne(id, req.user.userId, req.user.role);
  }

  @Patch(':id/resolve')
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() resolveDto: ResolveDisputeDto,
  ) {
    return this.disputesService.resolve(
      id,
      req.user.userId,
      req.user.role,
      resolveDto,
    );
  }
}
