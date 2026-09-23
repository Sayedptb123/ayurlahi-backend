import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { AuditReadService } from './audit-read.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

/**
 * Decision A (locked, see
 * scope/Audit_Trail_ReadAPI_AdminUI_Implementation_Plan.md): SUPER_ADMIN
 * and SUPPORT only. Same guard combo already proven at
 * scraper.controller.ts and promotions.controller.ts.
 */
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPPORT)
export class AuditController {
  constructor(private readonly auditReadService: AuditReadService) {}

  @Get()
  findAll(@Query() query: QueryAuditLogsDto) {
    return this.auditReadService.findAll(query);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('createdAt') createdAt: string,
  ) {
    if (!createdAt) {
      throw new BadRequestException('createdAt query parameter is required.');
    }
    return this.auditReadService.findOne(id, createdAt);
  }
}
