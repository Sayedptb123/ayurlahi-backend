import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { StaffBranchAssignment } from './entities/staff-branch-assignment.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Staff } from '../staff/entities/staff.entity';
import { CreateStaffBranchAssignmentDto } from './dto/create-staff-branch-assignment.dto';
import { UpdateStaffBranchAssignmentDto } from './dto/update-staff-branch-assignment.dto';
import { GetStaffBranchAssignmentsDto } from './dto/get-staff-branch-assignments.dto';

@Injectable()
export class StaffBranchAssignmentsService {
  constructor(
    @InjectRepository(StaffBranchAssignment)
    private readonly assignmentsRepository: Repository<StaffBranchAssignment>,
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
  ) {}

  async create(
    organisationId: string,
    createDto: CreateStaffBranchAssignmentDto,
    createdBy?: string,
  ): Promise<StaffBranchAssignment> {
    // Verify branch exists and belongs to organisation
    const branch = await this.branchesRepository.findOne({
      where: { id: createDto.branchId, organisationId, deletedAt: IsNull() },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    // ADR-004 D13 — a pending/rejected branch is not usable yet.
    if (branch.approvalStatus !== 'approved') {
      throw new BadRequestException('Branch is not yet approved and cannot be assigned staff');
    }

    // Verify staff exists and belongs to organisation
    const staff = await this.staffRepository.findOne({
      where: { id: createDto.staffId, organisationId: organisationId },
    });
    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    // Check if staff already assigned to this branch (active)
    const existing = await this.assignmentsRepository.findOne({
      where: {
        staffId: createDto.staffId,
        branchId: createDto.branchId,
        isActive: true,
      },
    });
    if (existing) {
      throw new ConflictException('Staff is already assigned to this branch');
    }

    // If setting as primary, unset other primary assignments
    if (createDto.isPrimary) {
      await this.assignmentsRepository.update(
        { staffId: createDto.staffId, isPrimary: true },
        { isPrimary: false },
      );
    }

    const assignment = this.assignmentsRepository.create({
      ...createDto,
      organisationId,
      assignedFrom: createDto.assignedFrom
        ? new Date(createDto.assignedFrom)
        : new Date(),
      assignedTo: createDto.assignedTo ? new Date(createDto.assignedTo) : null,
      createdBy,
    });

    return await this.assignmentsRepository.save(assignment);
  }

  async findAll(
    organisationId: string,
    query: GetStaffBranchAssignmentsDto,
  ): Promise<{ data: StaffBranchAssignment[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      branchId,
      staffId,
      assignmentType,
      isActive,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.assignmentsRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.branch', 'branch')
      .leftJoinAndSelect('assignment.staff', 'staff')
      .where('assignment.organisationId = :organisationId', {
        organisationId,
      });

    if (branchId) {
      queryBuilder.andWhere('assignment.branchId = :branchId', { branchId });
    }

    if (staffId) {
      queryBuilder.andWhere('assignment.staffId = :staffId', { staffId });
    }

    if (assignmentType) {
      queryBuilder.andWhere('assignment.assignmentType = :assignmentType', {
        assignmentType,
      });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('assignment.isActive = :isActive', { isActive });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('assignment.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total };
  }

  async findOne(
    id: string,
    organisationId: string,
  ): Promise<StaffBranchAssignment> {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id, organisationId },
      relations: ['branch', 'staff'],
    });

    if (!assignment) {
      throw new NotFoundException(
        `StaffBranchAssignment with ID ${id} not found`,
      );
    }

    return assignment;
  }

  async update(
    id: string,
    organisationId: string,
    updateDto: UpdateStaffBranchAssignmentDto,
  ): Promise<StaffBranchAssignment> {
    const assignment = await this.findOne(id, organisationId);

    // If setting as primary, unset other primary assignments
    if (updateDto.isPrimary && !assignment.isPrimary) {
      await this.assignmentsRepository.update(
        { staffId: assignment.staffId, isPrimary: true },
        { isPrimary: false },
      );
    }

    if (updateDto.assignedTo) {
      assignment.assignedTo = new Date(updateDto.assignedTo);
    }

    Object.assign(assignment, updateDto);
    return await this.assignmentsRepository.save(assignment);
  }

  async remove(id: string, organisationId: string): Promise<void> {
    const assignment = await this.findOne(id, organisationId);
    await this.assignmentsRepository.softDelete(assignment.id);
  }

  async getStaffBranches(
    staffId: string,
    organisationId: string,
  ): Promise<Branch[]> {
    const assignments = await this.assignmentsRepository.find({
      where: { staffId, organisationId, isActive: true },
      relations: ['branch'],
    });

    return assignments.map((a) => a.branch);
  }

  async getBranchStaff(
    branchId: string,
    organisationId: string,
  ): Promise<Staff[]> {
    const assignments = await this.assignmentsRepository.find({
      where: { branchId, organisationId, isActive: true },
      relations: ['staff'],
    });

    return assignments.map((a) => a.staff);
  }

  // Staff who exist on this org's roster but have never been given an active
  // branch assignment — a real, expected state (assignment is a manual step
  // separate from creating the staff record, see ADR-004 D5), not a bug. Lets
  // the super-admin branch drill-down show "N staff not yet assigned" instead
  // of silently omitting them from every branch.
  async getUnassignedStaff(organisationId: string): Promise<Staff[]> {
    const assignedStaffIds = await this.assignmentsRepository
      .createQueryBuilder('assignment')
      .select('DISTINCT assignment.staff_id', 'staffId')
      .where('assignment.organisation_id = :organisationId', { organisationId })
      .andWhere('assignment.is_active = true')
      .getRawMany<{ staffId: string }>();

    const qb = this.staffRepository
      .createQueryBuilder('staff')
      .where('staff.organisation_id = :organisationId', { organisationId });

    if (assignedStaffIds.length) {
      qb.andWhere('staff.id NOT IN (:...assignedStaffIds)', {
        assignedStaffIds: assignedStaffIds.map((r) => r.staffId),
      });
    }

    return qb.getMany();
  }

  // Per-staff list of the branches they're actively assigned to, for the
  // Staff & Access "Branches" column — a pure read/derivation over the same
  // findAll() this module's own CRUD controller already uses, so this adds no
  // new assignment write path. One call for the whole org avoids querying
  // per-branch-per-staff from the frontend.
  async getStaffBranchSummary(
    organisationId: string,
  ): Promise<{ staffId: string; branches: { id: string; name: string }[] }[]> {
    const { data } = await this.findAll(organisationId, {
      isActive: true,
      limit: 100,
    } as GetStaffBranchAssignmentsDto);

    const byStaff = new Map<string, { id: string; name: string }[]>();
    for (const a of data) {
      if (!a.staffId || !a.branch) continue;
      const list = byStaff.get(a.staffId) ?? [];
      list.push({ id: a.branch.id, name: a.branch.name });
      byStaff.set(a.staffId, list);
    }

    return Array.from(byStaff.entries()).map(([staffId, branches]) => ({ staffId, branches }));
  }
}


