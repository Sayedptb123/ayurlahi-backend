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
  Request,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LeaveService } from './leave.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestStatusDto } from './dto/update-leave-request-status.dto';
import { AllocateLeaveBalanceDto } from './dto/allocate-leave-balance.dto';
import { LeaveStatus } from './entities/leave-request.entity';

@ApiTags('leave')
@ApiBearerAuth('access-token')
@Controller('leave')
@UseGuards(JwtAuthGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  // ==========================================================================
  // LEAVE TYPES
  // ==========================================================================

  @ApiOperation({ summary: 'Create a new leave type policy (Manager only)' })
  @Post('types')
  createLeaveType(@Request() req, @Body() dto: CreateLeaveTypeDto) {
    this.checkManagerRole(req.user.role);
    return this.leaveService.createLeaveType(req.user.organisationId, dto);
  }

  @ApiOperation({ summary: 'Get all active leave types for the organisation' })
  @Get('types')
  findAllLeaveTypes(@Request() req) {
    return this.leaveService.findAllLeaveTypes(req.user.organisationId);
  }

  @ApiOperation({ summary: 'Update a leave type policy (Manager only)' })
  @Patch('types/:id')
  updateLeaveType(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: UpdateLeaveTypeDto
  ) {
    this.checkManagerRole(req.user.role);
    return this.leaveService.updateLeaveType(id, req.user.organisationId, dto);
  }

  @ApiOperation({ summary: 'Soft delete a leave type policy (Manager only)' })
  @Delete('types/:id')
  deleteLeaveType(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    this.checkManagerRole(req.user.role);
    return this.leaveService.deleteLeaveType(id, req.user.organisationId);
  }

  // ==========================================================================
  // LEAVE REQUESTS
  // ==========================================================================

  @ApiOperation({ summary: 'Apply for a new leave request' })
  @Post('requests')
  applyForLeave(@Request() req, @Body() dto: CreateLeaveRequestDto) {
    return this.leaveService.applyForLeave(req.user.organisationId, dto, req.user.userId);
  }

  @ApiOperation({ summary: 'Get leave requests (scoped by role)' })
  @Get('requests')
  findAllLeaveRequests(
    @Request() req,
    @Query('status') status?: LeaveStatus,
    @Query('staffId') staffId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.leaveService.findAllLeaveRequests(req.user.organisationId, req.user.userId, req.user.role, {
      status,
      staffId,
      startDate,
      endDate,
    });
  }

  @ApiOperation({ summary: 'Get details of a single leave request' })
  @Get('requests/:id')
  findOneLeaveRequest(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.leaveService.findOneLeaveRequest(id, req.user.organisationId, req.user.userId, req.user.role);
  }

  @ApiOperation({ summary: 'Update status of a leave request (Approve/Reject by manager, Cancel by requester)' })
  @Patch('requests/:id/status')
  updateLeaveRequestStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: UpdateLeaveRequestStatusDto
  ) {
    return this.leaveService.updateLeaveRequestStatus(
      id,
      req.user.organisationId,
      dto,
      req.user.userId,
      req.user.role
    );
  }

  // ==========================================================================
  // LEAVE BALANCES
  // ==========================================================================

  @ApiOperation({ summary: 'Get leave balances (scoped by role)' })
  @Get('balances')
  getLeaveBalances(
    @Request() req,
    @Query('staffId') staffId?: string,
    @Query('year') year?: string
  ) {
    const parsedYear = year ? parseInt(year) : undefined;
    return this.leaveService.getLeaveBalances(
      req.user.organisationId,
      req.user.userId,
      req.user.role,
      staffId,
      parsedYear
    );
  }

  @ApiOperation({ summary: 'Manually allocate or adjust staff leave balances (Manager only)' })
  @Post('balances/allocate')
  allocateBalance(@Request() req, @Body() dto: AllocateLeaveBalanceDto) {
    this.checkManagerRole(req.user.role);
    return this.leaveService.allocateBalance(req.user.organisationId, dto);
  }

  // ==========================================================================
  // YEAR ROLLOVER
  // ==========================================================================

  @ApiOperation({ summary: 'Manually trigger year rollover to carry forward surplus leaves (Manager only)' })
  @Post('rollover')
  runYearRollover(@Request() req, @Body('fromYear') fromYear: number) {
    this.checkManagerRole(req.user.role);
    if (!fromYear || typeof fromYear !== 'number') {
      throw new ForbiddenException('Valid fromYear parameter is required');
    }
    return this.leaveService.runYearRollover(req.user.organisationId, fromYear);
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private checkManagerRole(role: string) {
    const isManager = ['OWNER', 'MANAGER', 'ADMIN', 'AYURLAHI_TEAM'].includes(role);
    if (!isManager) {
      throw new ForbiddenException('Only managers and owners can perform this operation');
    }
  }
}
