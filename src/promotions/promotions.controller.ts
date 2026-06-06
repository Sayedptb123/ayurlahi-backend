import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { PromotionEventType } from './entities/promotion-event.entity';
import { CreatePromotionDto, UpdatePromotionDto } from './dto/promotion.dto';

@Controller('promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  // ---- Admin (AYURLAHI_TEAM only) ----
  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPPORT)
  createPromotion(@Body() dto: CreatePromotionDto, @Req() req: any) {
    return this.promotionsService.createPromotion(dto, req.user.id);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPPORT)
  findAll() {
    return this.promotionsService.findAll();
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPPORT)
  updatePromotion(@Param('id') id: string, @Body() dto: UpdatePromotionDto) {
    return this.promotionsService.updatePromotion(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPPORT)
  removePromotion(@Param('id') id: string) {
    return this.promotionsService.removePromotion(id);
  }

  // ---- Client (any authenticated user) ----
  @Get('active')
  getActivePromotions(@Query('placement') placement: string, @Req() req: any) {
    return this.promotionsService.getActivePromotions(
      placement,
      req.user.organisationType,
      req.user.organisationId,
    );
  }

  @Post(':id/event')
  recordEvent(
    @Param('id') promotionId: string,
    @Body('eventType') eventType: PromotionEventType,
    @Req() req: any,
  ) {
    return this.promotionsService.recordEvent(
      promotionId,
      req.user.id,
      req.user.organisationId,
      eventType,
    );
  }
}
