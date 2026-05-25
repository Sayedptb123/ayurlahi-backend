import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { FeedingLogsService } from './feeding-logs.service';
import { CreateFeedingLogDto } from './dto/create-feeding-log.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Feeding Logs')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('organisations/:organisationId/feeding-logs')
export class FeedingLogsController {
  constructor(private readonly feedingLogsService: FeedingLogsService) {}

  @Get()
  @ApiOperation({ summary: 'List feeding logs for an organisation, optionally filtered by baby patient' })
  @ApiQuery({ name: 'patientId', required: false, description: 'Filter by baby patient UUID' })
  getFeedingLogs(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.feedingLogsService.getFeedingLogs(organisationId, patientId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new feeding log entry' })
  createFeedingLog(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @Body() dto: CreateFeedingLogDto,
    @Request() req,
  ) {
    return this.feedingLogsService.createFeedingLog(
      organisationId,
      dto,
      req.user.userId,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a feeding log entry' })
  deleteFeedingLog(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.feedingLogsService.deleteFeedingLog(organisationId, id);
  }
}
