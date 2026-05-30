import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  Staff,
  StaffPosition,
} from './entities/staff.entity';
import { User } from '../users/entities/user.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { GetStaffDto } from './dto/get-staff.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';


@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(OrganisationUser)
    private organisationUsersRepository: Repository<OrganisationUser>,
    private readonly notificationsService: NotificationsService,
  ) { }

  // Clinic positions that clinic users can create
  private readonly clinicPositions = [
    StaffPosition.DOCTOR,
    StaffPosition.THERAPIST,
    StaffPosition.AYURVEDIC_PRACTITIONER,
    StaffPosition.MASSAGE_THERAPIST,
    StaffPosition.YOGA_INSTRUCTOR,
    StaffPosition.DIETITIAN,
    StaffPosition.NUTRITIONIST,
    StaffPosition.PHARMACIST,
    StaffPosition.NURSE,
    StaffPosition.COOK,
    StaffPosition.CHEF,
    StaffPosition.HELPER,
    StaffPosition.ASSISTANT,
    StaffPosition.RECEPTIONIST,
    StaffPosition.MANAGER,
    StaffPosition.ADMINISTRATOR,
    StaffPosition.OTHER,
  ];

  // Manufacturer positions that manufacturer users can create
  private readonly manufacturerPositions = [
    StaffPosition.PRODUCTION_MANAGER,
    StaffPosition.QUALITY_CONTROL,
    StaffPosition.PACKAGER,
    StaffPosition.WAREHOUSE_STAFF,
    StaffPosition.SALES_REPRESENTATIVE,
    StaffPosition.ACCOUNTANT,
    StaffPosition.SUPERVISOR,
    StaffPosition.TECHNICIAN,
    StaffPosition.MANAGER,
    StaffPosition.ADMINISTRATOR,
    StaffPosition.OTHER,
  ];

  private async getOrganizationId(userId: string): Promise<string> {
    // organisation_users is the authoritative source for org membership
    const orgUser = await this.organisationUsersRepository.findOne({
      where: { userId },
    });

    if (orgUser) {
      return orgUser.organisationId;
    }

    throw new ForbiddenException('User organization not found');
  }

  async findAll(userId: string, userRole: string, query: GetStaffDto) {
    console.log('[Staff Service] findAll called:', { userId, userRole, query });
    const { page = 1, limit = 20, position, isActive, organizationId: organisationId } = query;
    const skip = (page - 1) * limit;

    // Only clinic, manufacturer and admin users can access staff
    if (!['clinic', 'manufacturer', 'admin', 'SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF'].includes(userRole)) {
      throw new ForbiddenException('You do not have permission to view staff');
    }

    // Determine which organization to filter by
    let targetOrganizationId: string | null = null;

    if (organisationId && ['admin', 'SUPER_ADMIN'].includes(userRole)) {
      // Admin provided specific organisationId in query - use that
      targetOrganizationId = organisationId;
      console.log('[Staff Service] Admin filtering by provided organisationId:', targetOrganizationId);
    } else if (!['admin', 'SUPER_ADMIN'].includes(userRole)) {
      // Non-admin users: filter by their own organization
      try {
        targetOrganizationId = await this.getOrganizationId(userId);
        console.log('[Staff Service] Non-admin user, filtering by their organisationId:', targetOrganizationId);
      } catch (e) {
        console.log('[Staff Service] Organization check failed:', e.message);
        throw new ForbiddenException('User organization not found');
      }
    }
    // If admin and no organisationId provided, targetOrganizationId stays null (show all)

    // Build query
    const queryBuilder = this.staffRepository.createQueryBuilder('staff');

    if (targetOrganizationId) {
      console.log('[Staff Service] Filtering by organisationId:', targetOrganizationId);
      queryBuilder.where('staff.organisationId = :organisationId', {
        organisationId: targetOrganizationId,
      });
    }

    if (position) {
      queryBuilder.andWhere('staff.position = :position', { position });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('staff.isActive = :isActive', { isActive });
    }

    const total = await queryBuilder.getCount();
    console.log('[Staff Service] Total count:', total);
    queryBuilder.skip(skip).take(limit);
    queryBuilder.orderBy('staff.createdAt', 'DESC');

    const data = await queryBuilder.getMany();
    console.log('[Staff Service] Data retrieved:', data.length, 'records');

    // Batch-fetch permissions from organisation_users for staff who have user accounts
    const userIds = data.filter((s) => s.userId).map((s) => s.userId as string);
    const permissionsMap: Record<string, Record<string, boolean> | null> = {};
    if (userIds.length > 0 && targetOrganizationId) {
      const orgUsers = await this.organisationUsersRepository.find({
        where: { userId: In(userIds), organisationId: targetOrganizationId },
        select: ['userId', 'permissions'],
      });
      for (const ou of orgUsers) {
        if (ou.userId) permissionsMap[ou.userId] = ou.permissions ?? null;
      }
    }

    return {
      data: data.map((staff) => this.mapToResponse(staff, staff.userId ? (permissionsMap[staff.userId] ?? null) : null)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string, userRole: string) {
    const staff = await this.staffRepository.findOne({ where: { id } });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    // Verify user belongs to same organization (unless admin)
    if (!['admin', 'SUPER_ADMIN'].includes(userRole)) {
      const organisationId = await this.getOrganizationId(userId);
      if (staff.organisationId !== organisationId) {
        throw new ForbiddenException(
          'You do not have access to this staff member',
        );
      }
    }

    return this.mapToResponse(staff);
  }

  async create(userId: string, userRole: string, createDto: CreateStaffDto) {
    // Only clinic and manufacturer users can create staff
    if (!['clinic', 'manufacturer', 'OWNER', 'MANAGER'].includes(userRole)) {
      throw new ForbiddenException(
        'Only clinic and manufacturer users can create staff',
      );
    }

    const organisationId = await this.getOrganizationId(userId);

    // Validate position matches organization type
    // We assume clinic for now if checking organization users, or logic needs to be smarter
    // For now, let's allow all positions if we found valid organisationId
    const allowedPositions = [...this.clinicPositions, ...this.manufacturerPositions];

    if (!allowedPositions.includes(createDto.position)) {
      throw new BadRequestException('Invalid position for organization type');
    }

    // Validate positionCustom if position is 'other'
    if (
      createDto.position === StaffPosition.OTHER &&
      !createDto.positionCustom
    ) {
      throw new BadRequestException(
        'positionCustom is required when position is "other"',
      );
    }

    const staff = this.staffRepository.create({
      organisationId,
      firstName: createDto.firstName,
      lastName: createDto.lastName,
      position: createDto.position,
      positionCustom: createDto.positionCustom || null,
      email: createDto.email || null,
      phone: createDto.phone || null,
      whatsappNumber: createDto.whatsappNumber || null,
      address: (createDto.address as Record<string, any>) || null,
      dateOfBirth: createDto.dateOfBirth ? new Date(createDto.dateOfBirth) : null,
      dateOfJoining: createDto.dateOfJoining ? new Date(createDto.dateOfJoining) : null,
      salary: createDto.salary || null,
      qualifications: createDto.qualifications || null,
      specialization: createDto.specialization || null,
      // Doctor-specific fields (only meaningful when position === 'doctor')
      doctorCode: createDto.doctorCode || null,
      licenseNumber: createDto.licenseNumber || null,
      consultationFee: createDto.consultationFee ?? null,
      schedule: createDto.schedule || null,
      isActive: true,
      notes: createDto.notes || null,
    });

    const savedStaff = await this.staffRepository.save(staff) as Staff;

    // Create user account if requested
    if (createDto.createUserAccount && createDto.password) {
      // Validate email or phone exists
      if (!savedStaff.email && !savedStaff.phone) {
        throw new BadRequestException(
          'Staff member must have email or phone number to create user account',
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(createDto.password, 10);

      // Re-use existing user if email/phone already exists, otherwise create
      const emailPhoneWhere: any[] = [];
      if (savedStaff.email) emailPhoneWhere.push({ email: savedStaff.email });
      if (savedStaff.phone) emailPhoneWhere.push({ phone: savedStaff.phone });
      const existingUser = emailPhoneWhere.length
        ? await this.usersRepository.findOne({ where: emailPhoneWhere })
        : null;

      let savedUser: User;
      if (existingUser) {
        const alreadyInOrg = await this.organisationUsersRepository.findOne({
          where: { userId: existingUser.id, organisationId },
        });
        if (alreadyInOrg) {
          throw new ConflictException(
            'A user with this email or phone already belongs to this organisation',
          );
        }
        savedUser = existingUser;
      } else {
        const user = this.usersRepository.create({
          email: savedStaff.email || null,
          phone: savedStaff.phone || `STAFF_${Date.now()}`,
          firstName: savedStaff.firstName,
          lastName: savedStaff.lastName,
          passwordHash: hashedPassword,
          isActive: true,
          isEmailVerified: false,
        });
        savedUser = await this.usersRepository.save(user);
      }

      // Map staff position to organization role
      const role = this.mapPositionToRole(savedStaff.position);

      // Create organisation_users entry
      const orgUser = this.organisationUsersRepository.create({
        userId: savedUser.id,
        organisationId: organisationId,
        role: role as any,
        isPrimary: false,
        permissions: this.getDefaultPermissions(role),
      });

      await this.organisationUsersRepository.save(orgUser);

      // Update staff record with user ID (use update() to avoid sending null organisationType)
      await this.staffRepository.update(savedStaff.id, {
        userId: savedUser.id,
        hasUserAccount: true,
        userAccountStatus: 'active' as any,
      });
      savedStaff.userId = savedUser.id;
      savedStaff.hasUserAccount = true;
      savedStaff.userAccountStatus = 'active' as any;
    }

    return this.mapToResponse(savedStaff);
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    updateDto: UpdateStaffDto,
  ) {
    const staff = await this.staffRepository.findOne({ where: { id } });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    // Verify user belongs to same organization (unless admin)
    if (!['admin', 'SUPER_ADMIN'].includes(userRole)) {
      const organisationId = await this.getOrganizationId(userId);
      if (staff.organisationId !== organisationId) {
        throw new ForbiddenException(
          'You do not have access to this staff member',
        );
      }
    }

    // Validate positionCustom if position is being set to 'other'
    if (
      updateDto.position === StaffPosition.OTHER &&
      !updateDto.positionCustom
    ) {
      throw new BadRequestException(
        'positionCustom is required when position is "other"',
      );
    }

    // Update fields
    if (updateDto.firstName !== undefined)
      staff.firstName = updateDto.firstName;
    if (updateDto.lastName !== undefined) staff.lastName = updateDto.lastName;
    if (updateDto.position !== undefined) staff.position = updateDto.position;
    if (updateDto.positionCustom !== undefined)
      staff.positionCustom = updateDto.positionCustom;
    if (updateDto.email !== undefined) staff.email = updateDto.email;
    if (updateDto.phone !== undefined) staff.phone = updateDto.phone;
    if (updateDto.whatsappNumber !== undefined)
      staff.whatsappNumber = updateDto.whatsappNumber;
    if (updateDto.address !== undefined) {
      staff.address = (updateDto.address as Record<string, any>) || null;
    }
    if (updateDto.dateOfBirth !== undefined)
      staff.dateOfBirth = updateDto.dateOfBirth
        ? new Date(updateDto.dateOfBirth)
        : null;
    if (updateDto.dateOfJoining !== undefined)
      staff.dateOfJoining = updateDto.dateOfJoining
        ? new Date(updateDto.dateOfJoining)
        : null;
    if (updateDto.salary !== undefined) staff.salary = updateDto.salary;
    if (updateDto.qualifications !== undefined)
      staff.qualifications = updateDto.qualifications;
    if (updateDto.specialization !== undefined)
      staff.specialization = updateDto.specialization;
    if (updateDto.isActive !== undefined) staff.isActive = updateDto.isActive;
    if (updateDto.notes !== undefined) staff.notes = updateDto.notes;

    const updatedStaff = await this.staffRepository.save(staff);

    // Create user account if requested and doesn't exist
    if (updateDto.createUserAccount && updateDto.password && !staff.userId) {
      // Validate email or phone exists
      if (!updatedStaff.email && !updatedStaff.phone) {
        throw new BadRequestException(
          'Staff member must have email or phone number to create user account',
        );
      }

      // Check for an existing user with this email/phone
      const emailPhoneWhere: any[] = [];
      if (updatedStaff.email) emailPhoneWhere.push({ email: updatedStaff.email });
      if (updatedStaff.phone) emailPhoneWhere.push({ phone: updatedStaff.phone });
      const existingUser = emailPhoneWhere.length
        ? await this.usersRepository.findOne({ where: emailPhoneWhere })
        : null;

      let savedUser: User;
      if (existingUser) {
        const alreadyInOrg = await this.organisationUsersRepository.findOne({
          where: { userId: existingUser.id, organisationId: updatedStaff.organisationId },
        });
        if (alreadyInOrg) {
          throw new ConflictException(
            'A user with this email or phone already belongs to this organisation',
          );
        }
        savedUser = existingUser;
      } else {
        const hashedPassword = await bcrypt.hash(updateDto.password, 10);
        const user = this.usersRepository.create({
          email: updatedStaff.email || null,
          phone: updatedStaff.phone || `STAFF_${Date.now()}`,
          firstName: updatedStaff.firstName,
          lastName: updatedStaff.lastName,
          passwordHash: hashedPassword,
          isActive: true,
          isEmailVerified: false,
        });
        savedUser = await (this.usersRepository.save(user) as Promise<User>);
      }

      // Map staff position to organization role
      const role = this.mapPositionToRole(updatedStaff.position);

      // Guard: don't create a duplicate org_user if one already exists
      const existingOrgUser = await this.organisationUsersRepository.findOne({
        where: { userId: savedUser.id, organisationId: updatedStaff.organisationId },
      });

      if (!existingOrgUser) {
        const orgUser = this.organisationUsersRepository.create({
          userId: savedUser.id,
          organisationId: updatedStaff.organisationId,
          role: role as any,
          isPrimary: false,
          permissions: this.getDefaultPermissions(role),
        });
        await this.organisationUsersRepository.save(orgUser);
      }

      // Use update() to avoid sending null organisationType column
      await this.staffRepository.update(updatedStaff.id, {
        userId: savedUser.id,
        hasUserAccount: true,
        userAccountStatus: 'active' as any,
      });
      updatedStaff.userId = savedUser.id;
      updatedStaff.hasUserAccount = true;
      updatedStaff.userAccountStatus = 'active' as any;
    }

    return this.mapToResponse(updatedStaff);
  }

  async remove(id: string, userId: string, userRole: string) {
    const staff = await this.staffRepository.findOne({ where: { id } });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    // Verify user belongs to same organization (unless admin)
    if (!['admin', 'SUPER_ADMIN'].includes(userRole)) {
      const organisationId = await this.getOrganizationId(userId);
      if (staff.organisationId !== organisationId) {
        throw new ForbiddenException(
          'You do not have access to this staff member',
        );
      }
    }

    await this.staffRepository.softDelete(staff.id);
    return { message: 'Staff member deleted successfully' };
  }

  async toggleStatus(id: string, userId: string, userRole: string) {
    const staff = await this.staffRepository.findOne({ where: { id } });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    // Verify user belongs to same organization (unless admin)
    if (!['admin', 'SUPER_ADMIN'].includes(userRole)) {
      const organisationId = await this.getOrganizationId(userId);
      if (staff.organisationId !== organisationId) {
        throw new ForbiddenException(
          'You do not have access to this staff member',
        );
      }
    }

    staff.isActive = !staff.isActive;
    const updatedStaff = await this.staffRepository.save(staff);
    return this.mapToResponse(updatedStaff);
  }

  // ============================================================================
  // STAFF INVITATION METHODS
  // ============================================================================

  async inviteStaff(
    staffId: string,
    userId: string,
    userRole: string,
    sendEmail: boolean = true,
    sendSMS: boolean = false,
  ) {
    try {
      console.log('[Staff Service] inviteStaff called:', { staffId, userId, userRole });

      // Only OWNER, MANAGER, ADMIN can invite staff
      if (!['OWNER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
        throw new ForbiddenException('You do not have permission to invite staff');
      }

      console.log('[Staff Service] Finding staff...');
      const staff = await this.staffRepository.findOne({ where: { id: staffId } });

      if (!staff) {
        throw new NotFoundException(`Staff member with ID ${staffId} not found`);
      }

      console.log('[Staff Service] Staff found:', {
        id: staff.id,
        name: `${staff.firstName} ${staff.lastName}`,
        organisationId: staff.organisationId,
        email: staff.email,
        phone: staff.phone
      });

      // Verify user belongs to same organization
      if (!['SUPER_ADMIN'].includes(userRole)) {
        console.log('[Staff Service] Verifying organization access...');
        const organisationId = await this.getOrganizationId(userId);
        console.log('[Staff Service] User organisationId:', organisationId);

        if (staff.organisationId !== organisationId) {
          throw new ForbiddenException(
            'You do not have access to this staff member',
          );
        }
      }

      // Check if staff already has a user account
      if (staff.hasUserAccount && staff.userId) {
        throw new BadRequestException('Staff member already has a user account');
      }

      // Validate staff has email or phone
      if (!staff.email && !staff.phone) {
        throw new BadRequestException(
          'Staff member must have email or phone number to receive invitation',
        );
      }

      // Generate invitation token
      console.log('[Staff Service] Generating invitation token...');
      const invitationToken = this.generateInvitationToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiry

      // Create user account (inactive until invitation is accepted)
      console.log('[Staff Service] Creating user account...');
      const userData = {
        email: staff.email || null,
        phone: staff.phone || `TEMP_${Date.now()}`,
        firstName: staff.firstName,
        lastName: staff.lastName,
        passwordHash: null,
        isActive: false,
        isEmailVerified: false,
      };
      console.log('[Staff Service] User data:', userData);

      const user = this.usersRepository.create(userData);

      console.log('[Staff Service] Saving user...');
      const savedUser = await this.usersRepository.save(user);
      console.log('[Staff Service] User saved:', { id: savedUser.id });

      // Map staff position to organization role
      console.log('[Staff Service] Mapping position to role...');
      const role = this.mapPositionToRole(staff.position);
      console.log('[Staff Service] Mapped role:', role);

      // Create organisation_users entry
      console.log('[Staff Service] Creating organisation_users entry...');
      const orgUserData = {
        userId: savedUser.id,
        organisationId: staff.organisationId,
        role: role as any,
        isPrimary: false,
        permissions: this.getDefaultPermissions(role),
      };
      console.log('[Staff Service] OrgUser data:', orgUserData);


      const orgUser = this.organisationUsersRepository.create(orgUserData);

      console.log('[Staff Service] Saving organisation_users...');
      await this.organisationUsersRepository.save(orgUser);
      console.log('[Staff Service] Organisation_users saved');

      // Update staff record
      console.log('[Staff Service] Updating staff record...');
      staff.userId = savedUser.id;
      staff.hasUserAccount = true;
      staff.userAccountStatus = 'pending';
      staff.invitationToken = invitationToken;
      staff.invitationSentAt = new Date();
      staff.invitationExpiresAt = expiresAt;

      await this.staffRepository.save(staff);
      console.log('[Staff Service] Staff record updated');

      // TODO: Send invitation email/SMS
      // For now, we'll just log the invitation details
      console.log('[Staff Service] Invitation created successfully:', {
        staffId: staff.id,
        userId: savedUser.id,
        email: staff.email,
        phone: staff.phone,
        token: invitationToken,
        expiresAt,
      });

      return {
        message: 'Invitation sent successfully',
        expiresAt,
      };
    } catch (error) {
      console.error('[Staff Service] ERROR in inviteStaff:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        detail: error.detail,
      });
      throw error;
    }
  }

  async acceptInvitation(token: string, password: string, confirmPassword: string) {
    // Validate passwords match
    if (password !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Find staff by invitation token
    const staff = await this.staffRepository.findOne({
      where: { invitationToken: token },
    });

    if (!staff) {
      throw new NotFoundException('Invalid invitation token');
    }

    // Check if token is expired
    if (staff.invitationExpiresAt && new Date() > staff.invitationExpiresAt) {
      throw new BadRequestException('Invitation token has expired');
    }

    // Check if invitation is already accepted
    if (staff.userAccountStatus === 'active') {
      throw new BadRequestException('Invitation has already been accepted');
    }

    // Get user account
    if (!staff.userId) {
      throw new BadRequestException('User account not found');
    }

    const user = await this.usersRepository.findOne({
      where: { id: staff.userId },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user account
    user.passwordHash = hashedPassword;
    user.isActive = true;
    await this.usersRepository.save(user);

    // Update staff record
    staff.userAccountStatus = 'active';
    staff.invitationToken = null; // Clear token after use
    await this.staffRepository.save(staff);

    // Notify org owners and managers that the staff member has joined
    this.organisationUsersRepository
      .find({ where: { organisationId: staff.organisationId, role: In(['OWNER', 'MANAGER', 'ADMIN']), isActive: true } })
      .then((orgUsers) => {
        const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean) as string[];
        if (userIds.length > 0) {
          this.notificationsService.sendToUsers({
            userIds,
            title: 'Staff Joined',
            body: `${staff.firstName} ${staff.lastName} has accepted the invitation and joined as ${staff.position}`,
            data: { staffId: staff.id, type: 'staff_joined' },
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return {
      message: 'Invitation accepted successfully. You can now log in.',
    };
  }

  async resendInvitation(
    staffId: string,
    userId: string,
    userRole: string,
  ) {
    const staff = await this.staffRepository.findOne({ where: { id: staffId } });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffId} not found`);
    }

    // Verify user belongs to same organization
    if (!['SUPER_ADMIN'].includes(userRole)) {
      const organisationId = await this.getOrganizationId(userId);
      if (staff.organisationId !== organisationId) {
        throw new ForbiddenException(
          'You do not have access to this staff member',
        );
      }
    }

    // Check if staff has a pending invitation
    if (!staff.hasUserAccount || staff.userAccountStatus !== 'pending') {
      throw new BadRequestException(
        'Staff member does not have a pending invitation',
      );
    }

    // Generate new invitation token
    const invitationToken = this.generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    staff.invitationToken = invitationToken;
    staff.invitationSentAt = new Date();
    staff.invitationExpiresAt = expiresAt;

    await this.staffRepository.save(staff);

    console.log('[Staff Service] Invitation resent:', {
      staffId: staff.id,
      email: staff.email,
      token: invitationToken,
    });

    return {
      message: 'Invitation resent successfully',
      invitationToken, // Return token for testing
      expiresAt,
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private getDefaultPermissions(role: string): Record<string, boolean> {
    const base = { dashboard: true, patients: true, appointments: true, admissions: true, doctors: false, ipd: false, duty: false, billing: false, staff: false, marketplace: false };
    if (role === 'MANAGER') return Object.fromEntries(Object.keys(base).map(k => [k, true])) as Record<string, boolean>;
    if (role === 'DOCTOR') return { ...base, doctors: true };
    return base;
  }

  private mapPositionToRole(position: StaffPosition): string {
    const roleMapping = {
      [StaffPosition.DOCTOR]: 'DOCTOR',
      [StaffPosition.NURSE]: 'NURSE',
      [StaffPosition.THERAPIST]: 'THERAPIST',
      [StaffPosition.PHARMACIST]: 'PHARMACIST',
      [StaffPosition.RECEPTIONIST]: 'RECEPTIONIST',
      [StaffPosition.MANAGER]: 'MANAGER',
      [StaffPosition.ADMINISTRATOR]: 'ADMIN',
      // Add more mappings as needed
    };

    return roleMapping[position] || 'STAFF'; // Default to STAFF role
  }

  private generateInvitationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private mapToResponse(staff: Staff, permissions: Record<string, boolean> | null = null) {
    return {
      id: staff.id,
      organisationId: staff.organisationId,
      firstName: staff.firstName,
      lastName: staff.lastName,
      position: staff.position,
      positionCustom: staff.positionCustom,
      email: staff.email,
      phone: staff.phone,
      whatsappNumber: staff.whatsappNumber,
      address: staff.address || null,
      dateOfBirth: staff.dateOfBirth
        ? (typeof staff.dateOfBirth === 'string'
          ? (staff.dateOfBirth as string).split('T')[0]
          : (staff.dateOfBirth as Date).toISOString().split('T')[0])
        : null,
      dateOfJoining: staff.dateOfJoining
        ? (typeof staff.dateOfJoining === 'string'
          ? (staff.dateOfJoining as string).split('T')[0]
          : (staff.dateOfJoining as Date).toISOString().split('T')[0])
        : null,
      salary: staff.salary ? Number(staff.salary) : null,
      qualifications: staff.qualifications,
      specialization: staff.specialization,
      // Doctor-specific (null when position !== 'doctor')
      doctorCode: staff.doctorCode ?? null,
      licenseNumber: staff.licenseNumber ?? null,
      consultationFee: staff.consultationFee != null ? Number(staff.consultationFee) : null,
      schedule: staff.schedule ?? null,
      isActive: staff.isActive,
      notes: staff.notes,
      // User account fields
      userId: staff.userId,
      hasUserAccount: staff.hasUserAccount,
      userAccountStatus: staff.userAccountStatus,
      invitationSentAt: staff.invitationSentAt?.toISOString() || null,
      invitationExpiresAt: staff.invitationExpiresAt?.toISOString() || null,
      createdAt: staff.createdAt.toISOString(),
      updatedAt: staff.updatedAt.toISOString(),
      // Permissions from organisation_users (null if staff has no user account)
      permissions,
    };
  }
}

