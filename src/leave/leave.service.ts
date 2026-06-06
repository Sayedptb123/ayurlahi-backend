import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveRequest, LeaveStatus } from './entities/leave-request.entity';
import { LeaveBalance } from './entities/leave-balance.entity';
import { Staff } from '../staff/entities/staff.entity';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestStatusDto } from './dto/update-leave-request-status.dto';
import { AllocateLeaveBalanceDto } from './dto/allocate-leave-balance.dto';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveType)
    private readonly leaveTypeRepository: Repository<LeaveType>,
    @InjectRepository(LeaveRequest)
    private readonly leaveRequestRepository: Repository<LeaveRequest>,
    @InjectRepository(LeaveBalance)
    private readonly leaveBalanceRepository: Repository<LeaveBalance>,
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
  ) {}

  // ==========================================================================
  // LEAVE TYPES
  // ==========================================================================

  async createLeaveType(organisationId: string, dto: CreateLeaveTypeDto) {
    const leaveType = this.leaveTypeRepository.create({
      ...dto,
      organisationId,
    });
    return this.leaveTypeRepository.save(leaveType);
  }

  async findAllLeaveTypes(organisationId: string) {
    return this.leaveTypeRepository.find({
      where: { organisationId, deletedAt: IsNull() },
      order: { name: 'ASC' },
    });
  }

  async updateLeaveType(id: string, organisationId: string, dto: UpdateLeaveTypeDto) {
    const leaveType = await this.leaveTypeRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
    });
    if (!leaveType) {
      throw new NotFoundException(`Leave type not found`);
    }
    Object.assign(leaveType, dto);
    return this.leaveTypeRepository.save(leaveType);
  }

  async deleteLeaveType(id: string, organisationId: string) {
    const leaveType = await this.leaveTypeRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
    });
    if (!leaveType) {
      throw new NotFoundException(`Leave type not found`);
    }
    leaveType.deletedAt = new Date();
    await this.leaveTypeRepository.save(leaveType);
    return { success: true };
  }

  // ==========================================================================
  // LEAVE REQUESTS
  // ==========================================================================

  async applyForLeave(organisationId: string, dto: CreateLeaveRequestDto, userId: string) {
    // 1. Verify staff belongs to organisation
    const staff = await this.staffRepository.findOne({
      where: { id: dto.staffId, organisationId, deletedAt: IsNull() },
    });
    if (!staff) {
      throw new NotFoundException(`Staff member not found in this organisation`);
    }

    // 2. Date validation
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (start > end) {
      throw new BadRequestException('Start date must be before or equal to end date');
    }

    // Enforce Option A: Single calendar year rule
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    if (startYear !== endYear) {
      throw new BadRequestException(
        'Leave requests cannot span across calendar years. Please submit separate requests for each year.'
      );
    }

    // 3. Find and check leave type
    const leaveType = await this.leaveTypeRepository.findOne({
      where: { id: dto.leaveTypeId, organisationId, deletedAt: IsNull() },
    });
    if (!leaveType || !leaveType.isActive) {
      throw new BadRequestException('Leave type is not active or does not exist');
    }

    // 4. Validate or auto-initialize balance (if the leave type is capped/has maxDays)
    let balance: LeaveBalance | null = null;
    if (leaveType.maxDaysPerYear !== null) {
      balance = await this.leaveBalanceRepository.findOne({
        where: {
          organisationId,
          staffId: dto.staffId,
          leaveTypeId: dto.leaveTypeId,
          year: startYear,
          deletedAt: IsNull(),
        },
      });

      // Auto-initialize balance if missing
      if (!balance) {
        balance = this.leaveBalanceRepository.create({
          organisationId,
          staffId: dto.staffId,
          leaveTypeId: dto.leaveTypeId,
          year: startYear,
          totalAllotted: leaveType.maxDaysPerYear,
          used: 0,
          carriedForward: 0,
        });
        balance = await this.leaveBalanceRepository.save(balance);
      }

      // Check balance limit
      const remaining = Number(balance.totalAllotted) + Number(balance.carriedForward) - Number(balance.used);
      if (dto.totalDays > remaining) {
        throw new BadRequestException(
          `Insufficient leave balance. Remaining: ${remaining} days, requested: ${dto.totalDays} days.`
        );
      }
    }

    // 5. Create leave request
    const status = leaveType.requiresApproval ? LeaveStatus.PENDING : LeaveStatus.APPROVED;

    const request = this.leaveRequestRepository.create({
      organisationId,
      staffId: dto.staffId,
      leaveTypeId: dto.leaveTypeId,
      startDate: start,
      endDate: end,
      totalDays: dto.totalDays,
      reason: dto.reason ?? null,
      status,
      requestedBy: userId,
      coveredByStaffId: dto.coveredByStaffId ?? null,
    });

    const savedRequest = await this.leaveRequestRepository.save(request);

    // If auto-approved, deduct balance immediately
    if (status === LeaveStatus.APPROVED && balance) {
      balance.used = Number(balance.used) + Number(dto.totalDays);
      await this.leaveBalanceRepository.save(balance);
    }

    return savedRequest;
  }

  async findAllLeaveRequests(
    organisationId: string,
    userId: string,
    role: string,
    query: { status?: LeaveStatus; staffId?: string; startDate?: string; endDate?: string } = {}
  ) {
    const isManager = ['OWNER', 'MANAGER', 'ADMIN', 'AYURLAHI_TEAM'].includes(role);

    const where: any = { organisationId, deletedAt: IsNull() };

    if (!isManager) {
      // Find staff associated with user
      const staff = await this.staffRepository.findOne({
        where: { userId, organisationId, deletedAt: IsNull() },
      });
      if (staff) {
        where.staffId = staff.id;
      } else {
        // Fallback: only requests submitted by this user
        where.requestedBy = userId;
      }
    } else if (query.staffId) {
      where.staffId = query.staffId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const requests = await this.leaveRequestRepository.find({
      where,
      relations: ['staff', 'leaveType', 'coveredByStaff'],
      order: { startDate: 'DESC' },
    });

    return requests;
  }

  async findOneLeaveRequest(id: string, organisationId: string, userId: string, role: string) {
    const request = await this.leaveRequestRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
      relations: ['staff', 'leaveType', 'coveredByStaff'],
    });

    if (!request) {
      throw new NotFoundException(`Leave request not found`);
    }

    const isManager = ['OWNER', 'MANAGER', 'ADMIN', 'AYURLAHI_TEAM'].includes(role);
    if (!isManager) {
      const staff = await this.staffRepository.findOne({
        where: { userId, organisationId, deletedAt: IsNull() },
      });
      if (request.requestedBy !== userId && (!staff || request.staffId !== staff.id)) {
        throw new ForbiddenException('You do not have permission to view this request');
      }
    }

    return request;
  }

  async updateLeaveRequestStatus(
    id: string,
    organisationId: string,
    dto: UpdateLeaveRequestStatusDto,
    userId: string,
    role: string
  ) {
    const request = await this.leaveRequestRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
      relations: ['leaveType'],
    });

    if (!request) {
      throw new NotFoundException(`Leave request not found`);
    }

    const isManager = ['OWNER', 'MANAGER', 'ADMIN', 'AYURLAHI_TEAM'].includes(role);
    
    // Authorization check
    if (dto.status === LeaveStatus.CANCELLED) {
      // Staff can cancel their own requests
      const staff = await this.staffRepository.findOne({
        where: { userId, organisationId, deletedAt: IsNull() },
      });
      const isOwnerOfRequest = request.requestedBy === userId || (staff && request.staffId === staff.id);
      
      if (!isManager && !isOwnerOfRequest) {
        throw new ForbiddenException('You can only cancel your own leave requests');
      }
    } else {
      // Only manager can Approve/Reject
      if (!isManager) {
        throw new ForbiddenException('Only managers and owners can approve or reject leaves');
      }
    }

    // Enforce valid state transitions
    if (request.status === LeaveStatus.CANCELLED || request.status === LeaveStatus.REJECTED) {
      throw new BadRequestException(`Cannot change status of a request that is already ${request.status}`);
    }

    const previousStatus = request.status;
    const year = new Date(request.startDate).getFullYear();

    // Find the staff's balance record
    let balance = await this.leaveBalanceRepository.findOne({
      where: {
        organisationId,
        staffId: request.staffId,
        leaveTypeId: request.leaveTypeId,
        year,
        deletedAt: IsNull(),
      },
    });

    // Handle transitions
    if (dto.status === LeaveStatus.APPROVED && previousStatus === LeaveStatus.PENDING) {
      // 1. Check if balance exists/needs initialization
      if (!balance && request.leaveType.maxDaysPerYear !== null) {
        balance = this.leaveBalanceRepository.create({
          organisationId,
          staffId: request.staffId,
          leaveTypeId: request.leaveTypeId,
          year,
          totalAllotted: request.leaveType.maxDaysPerYear,
          used: 0,
          carriedForward: 0,
        });
        balance = await this.leaveBalanceRepository.save(balance);
      }

      // 2. Verify sufficient balance remains before approving
      if (balance) {
        const remaining = Number(balance.totalAllotted) + Number(balance.carriedForward) - Number(balance.used);
        if (request.totalDays > remaining) {
          throw new BadRequestException(
            `Insufficient leave balance. Remaining: ${remaining} days, requested: ${request.totalDays} days.`
          );
        }
        
        // Deduct balance
        balance.used = Number(balance.used) + Number(request.totalDays);
        await this.leaveBalanceRepository.save(balance);
      }

      request.approvedBy = userId;
      request.approvedAt = new Date();
    } 
    else if (dto.status === LeaveStatus.CANCELLED && previousStatus === LeaveStatus.APPROVED) {
      // Return balance if cancelling an already approved request
      if (balance) {
        balance.used = Math.max(0, Number(balance.used) - Number(request.totalDays));
        await this.leaveBalanceRepository.save(balance);
      }
    }
    else if (dto.status === LeaveStatus.REJECTED && previousStatus === LeaveStatus.PENDING) {
      request.rejectionReason = dto.rejectionReason ?? null;
      request.approvedBy = userId;
      request.approvedAt = new Date();
    }

    request.status = dto.status;
    return this.leaveRequestRepository.save(request);
  }

  // ==========================================================================
  // LEAVE BALANCES
  // ==========================================================================

  async getLeaveBalances(
    organisationId: string,
    userId: string,
    role: string,
    staffIdFilter?: string,
    yearFilter?: number
  ) {
    const isManager = ['OWNER', 'MANAGER', 'ADMIN', 'AYURLAHI_TEAM'].includes(role);
    const year = yearFilter || new Date().getFullYear();

    let targetStaffId = staffIdFilter;

    if (!isManager) {
      // Find logged-in user's staff profile
      const staff = await this.staffRepository.findOne({
        where: { userId, organisationId, deletedAt: IsNull() },
      });
      if (!staff) {
        return []; // Standard user has no staff profile, hence no balances
      }
      targetStaffId = staff.id;
    }

    const where: any = { organisationId, year, deletedAt: IsNull() };
    if (targetStaffId) {
      where.staffId = targetStaffId;
    }

    const balances = await this.leaveBalanceRepository.find({
      where,
      relations: ['staff', 'leaveType'],
      order: { staffId: 'ASC' },
    });

    // Format output to calculate virtual balance (Remaining)
    return balances.map((b) => ({
      ...b,
      remaining: Number(b.totalAllotted) + Number(b.carriedForward) - Number(b.used),
    }));
  }

  async allocateBalance(organisationId: string, dto: AllocateLeaveBalanceDto) {
    // Check if balance already exists for this staff, type, year
    let balance = await this.leaveBalanceRepository.findOne({
      where: {
        organisationId,
        staffId: dto.staffId,
        leaveTypeId: dto.leaveTypeId,
        year: dto.year,
        deletedAt: IsNull(),
      },
    });

    if (balance) {
      balance.totalAllotted = dto.totalAllotted;
      if (dto.carriedForward !== undefined) {
        balance.carriedForward = dto.carriedForward;
      }
      return this.leaveBalanceRepository.save(balance);
    } else {
      balance = this.leaveBalanceRepository.create({
        organisationId,
        staffId: dto.staffId,
        leaveTypeId: dto.leaveTypeId,
        year: dto.year,
        totalAllotted: dto.totalAllotted,
        carriedForward: dto.carriedForward ?? 0,
        used: 0,
      });
      return this.leaveBalanceRepository.save(balance);
    }
  }

  // ==========================================================================
  // YEAR ROLLOVER
  // ==========================================================================

  async runYearRollover(organisationId: string, fromYear: number) {
    const toYear = fromYear + 1;
    console.log(`[Rollover] Running leave rollover from ${fromYear} to ${toYear} for organisation: ${organisationId}`);

    // Get all leave types that support carry forward
    const carryForwardTypes = await this.leaveTypeRepository.find({
      where: { organisationId, carryForward: true, deletedAt: IsNull() },
    });

    if (carryForwardTypes.length === 0) {
      return { message: 'No leave types are configured for carry forward rollover.' };
    }

    const carryForwardTypeIds = carryForwardTypes.map(t => t.id);

    // Get all active balances for the source year
    const activeBalances = await this.leaveBalanceRepository.find({
      where: {
        organisationId,
        year: fromYear,
        leaveTypeId: In(carryForwardTypeIds),
        deletedAt: IsNull(),
      },
    });

    let rolloverCount = 0;

    for (const balance of activeBalances) {
      const leaveType = carryForwardTypes.find(t => t.id === balance.leaveTypeId);
      if (!leaveType) continue;

      const remaining = Number(balance.totalAllotted) + Number(balance.carriedForward) - Number(balance.used);
      
      if (remaining > 0) {
        // Apply capping if specified
        const toCarry = leaveType.maxCarryForwardDays !== null
          ? Math.min(remaining, leaveType.maxCarryForwardDays)
          : remaining;

        // Find or create balance for next year
        let nextYearBalance = await this.leaveBalanceRepository.findOne({
          where: {
            organisationId,
            staffId: balance.staffId,
            leaveTypeId: balance.leaveTypeId,
            year: toYear,
            deletedAt: IsNull(),
          },
        });

        if (nextYearBalance) {
          nextYearBalance.carriedForward = toCarry;
          await this.leaveBalanceRepository.save(nextYearBalance);
        } else {
          nextYearBalance = this.leaveBalanceRepository.create({
            organisationId,
            staffId: balance.staffId,
            leaveTypeId: balance.leaveTypeId,
            year: toYear,
            totalAllotted: leaveType.maxDaysPerYear || 0,
            carriedForward: toCarry,
            used: 0,
          });
          await this.leaveBalanceRepository.save(nextYearBalance);
        }
        rolloverCount++;
      }
    }

    return {
      success: true,
      message: `Completed rollover to ${toYear}. Carried forward leaves for ${rolloverCount} balances.`,
    };
  }
}
